// app/api/cron/enrich/route.ts
// Enrich recently ingested papers:
// - Scrape ar5iv for GitHub links
// - Optionally fetch GitHub repo metadata + README
// - Extract structured fields via LLM (method/tasks/datasets/benchmarks/claims/code_urls)
// - Lookup Papers with Code mapping
// - Compute and upsert momentum scores
// - Insert enrichment/structured/PwC rows (latest rows are read by API)
//
// Protected by CRON_SECRET (Authorization: Bearer <secret> or x-cron-secret header)

import { NextResponse } from "next/server";
import { db, schema } from "@/lib/drizzle/db";
import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { assertCronSecret } from "@/lib/auth";
import { computePaperScore, type PaperForScoring } from "@/lib/scoring";
import { parseGitHubRepo, fetchRepoMeta, fetchRepoReadme } from "@/lib/github";
import { lookupPwcByArxiv } from "@/lib/pwc";
import { groq } from "@ai-sdk/groq";
import { generateObject } from "ai";
import { ExtractedLLM } from "@/lib/zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Defaults (override via query params)
const DEFAULT_LIMIT = 30; // papers to process
const DEFAULT_SINCE_DAYS = 7; // consider papers updated within last N days
const DEFAULT_FETCH_README = false;
const DEFAULT_RUN_EXTRACT = true;
const DEFAULT_RUN_PWC = true;

// LLM model (AI SDK v5)
const EXTRACT_MODEL = process.env.GROQ_EXTRACT_MODEL || "llama-3.3-70b-versatile";
const SERVICE_TIER: "flex" | "on_demand" | "auto" = "flex";

export async function POST(req: Request) {
  const startedAt = new Date();
  let processed = 0;
  const details: Array<{ arxivId: string; ok: boolean; info?: string; error?: string }> = [];

  try {
    assertCronSecret(req);

    const url = new URL(req.url);
    const idsParam = url.searchParams.get("ids")?.trim();
    const limit = clampInt(url.searchParams.get("limit"), DEFAULT_LIMIT, 1, 200);
    const sinceDays = clampInt(url.searchParams.get("days") || url.searchParams.get("sinceDays"), DEFAULT_SINCE_DAYS, 0, 60);
    const doReadme = asBool(url.searchParams.get("readme"), DEFAULT_FETCH_README);
    const doExtract = asBool(url.searchParams.get("extract"), DEFAULT_RUN_EXTRACT);
    const doPwc = asBool(url.searchParams.get("pwc"), DEFAULT_RUN_PWC);

    // Candidate selection
    const candidates = idsParam
      ? await getPapersByArxivIds(idsParam)
      : await getRecentCandidates(limit, sinceDays);

    // Process sequentially to be polite with APIs (simple; adjust to p-limit if needed)
    for (const p of candidates) {
      const baseId = p.arxivIdBase;
      try {
        // 1) ar5iv → GitHub URLs
        const ar5ivUrls = await fetchAr5ivGitHubUrls(baseId);

        // 2) GitHub meta (first canonical repo, if any)
        let primaryRepo: string | undefined;
        let repoStars: number | null | undefined;
        let repoLicense: string | null | undefined;
        let readmeExcerpt: string | undefined;
        let readmeSha: string | undefined;
        let hasWeights: boolean | undefined;

        const repoId = pickPrimaryRepo(ar5ivUrls);
        if (repoId) {
          primaryRepo = `${repoId.owner}/${repoId.repo}`;
          try {
            const meta = await fetchRepoMeta(repoId.owner, repoId.repo);
            repoStars = meta.stars ?? null;
            repoLicense = meta.license ?? null;
            // Optional README
            if (doReadme) {
              const readme = await fetchRepoReadme(repoId.owner, repoId.repo).catch(() => null);
              if (readme?.text) {
                readmeExcerpt = readme.text.slice(0, 1200);
                readmeSha = readme.sha;
                // Basic heuristic for "weights" presence
                hasWeights = /(?:checkpoint|weights|\.safetensors|\.pt|\.bin)/i.test(readme.text);
              }
            }
          } catch {
            // continue without meta
          }
        }

        // 3) Extract structured fields with LLM (optional)
        let extracted:
          | {
              method: string | null;
              tasks: string[];
              datasets: string[];
              benchmarks: string[];
              claimed_sota: Array<{ benchmark: string; metric?: string; value?: string; split?: string }>;
              code_urls: string[];
            }
          | null = null;

        if (doExtract) {
          const { object } = await generateObject({
            model: groq(EXTRACT_MODEL),
            temperature: 0.1,
            maxOutputTokens: 900,
            providerOptions: { groq: { structuredOutputs: true, serviceTier: SERVICE_TIER } },
            schema: ExtractedLLM,
            messages: [
              {
                role: "system",
                content: [
                  "Extract ONLY from the provided title and abstract. Do not speculate.",
                  "Return fields using the exact JSON schema.",
                  '- If a detail is absent, return empty array or null as appropriate; never fabricate.',
                  "Never assert SOTA unless explicitly stated.",
                ].join("\n"),
              },
              {
                role: "user",
                content: `Title: ${p.title}\n\nAbstract:\n${p.abstract}`,
              },
            ],
          });
          extracted = object;
        }

        // Merge code URLs (ar5iv + extract)
        const codeUrls = dedupe([...(ar5ivUrls ?? []), ...((extracted?.code_urls as string[]) ?? [])]);

        // 4) PwC mapping (optional)
        let pwc:
          | {
              found: boolean;
              paperUrl?: string | null;
              repoUrl?: string | null;
              repoStars?: number | null;
              searchUrl: string;
              sotaLinks: Array<{ label: string; url: string }>;
            }
          | null = null;
        if (doPwc) {
          pwc = await lookupPwcByArxiv(baseId).catch(() => null);
        }

        // 5) Insert enrichment row
        await db.insert(schema.paperEnrich).values({
          paperId: p.id,
          codeUrls,
          primaryRepo,
          repoLicense: repoLicense ?? null,
          repoStars: (repoStars as number | null) ?? null,
          hasWeights: hasWeights ?? null,
          readmeExcerpt: readmeExcerpt ?? null,
          readmeSha: readmeSha ?? null,
        });

        // 6) Insert structured extraction row
        if (extracted) {
          await db.insert(schema.paperStructured).values({
            paperId: p.id,
            method: extracted.method,
            tasks: extracted.tasks ?? [],
            datasets: extracted.datasets ?? [],
            benchmarks: extracted.benchmarks ?? [],
            claimedSota: extracted.claimed_sota ?? [],
            codeUrls,
          });
        }

        // 7) Upsert PwC mapping row
        if (pwc) {
          await db
            .insert(schema.pwcLinks)
            .values({
              paperId: p.id,
              found: Boolean(pwc.found),
              paperUrl: pwc.paperUrl ?? null,
              repoUrl: pwc.repoUrl ?? null,
              repoStars: typeof pwc.repoStars === "number" ? pwc.repoStars : null,
              searchUrl: pwc.searchUrl ?? "",
              sotaLinks: pwc.sotaLinks ?? [],
            })
            .catch(() => undefined); // ignore uniqueness conflicts if any
        }

        // 8) Compute momentum score and upsert
        const score = computePaperScore(
          {
            title: p.title,
            abstract: p.abstract,
            authors: [],
            categories: p.categories ?? [],
            publishedAt: p.publishedAt,
            codeUrls,
            hasWeights: hasWeights ?? null,
            repoStars: (repoStars as number | null) ?? (typeof pwc?.repoStars === "number" ? pwc!.repoStars : null),
            benchmarks: extracted?.benchmarks ?? [],
          } as PaperForScoring,
          [] // no user-specific watchlists in cron
        );

        await db
          .insert(schema.paperScores)
          .values({
            paperId: p.id,
            globalScore: String(score.global),
            components: score.components as any,
          })
          .onConflictDoUpdate({
            target: schema.paperScores.paperId,
            set: {
              globalScore: String(score.global),
              components: score.components as any,
              updatedAt: new Date(),
            },
          });

        processed++;
        details.push({ arxivId: baseId, ok: true, info: `${codeUrls.length} code urls${pwc ? "; pwc" : ""}` });
      } catch (e: any) {
        details.push({ arxivId: p.arxivIdBase, ok: false, error: e?.message || "error" });
      }
    }

    return json(
      {
        startedAt,
        finishedAt: new Date(),
        limit,
        sinceDays,
        extract: doExtract,
        readme: doReadme,
        pwc: doPwc,
        processed,
        items: details,
      },
      200
    );
  } catch (err: any) {
    return json({ error: err?.message || "Enrich failed" }, err?.status || 500);
  }
}

/* ========== Candidate selection ========== */

async function getPapersByArxivIds(idsCsv: string) {
  const ids = idsCsv
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map(stripVersion);

  if (ids.length === 0) return [];

  const rows = await db
    .select()
    .from(schema.papers)
    .where(inArray(schema.papers.arxivIdBase, ids))
    .orderBy(desc(schema.papers.publishedAt));

  return rows;
}

async function getRecentCandidates(limit: number, sinceDays: number) {
  const since =
    sinceDays > 0 ? new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000) : null;

  // Prefer papers that are missing enrich or structured or score rows
  // Fallback to latest by publishedAt
  const recent = await db
    .select()
    .from(schema.papers)
    .orderBy(desc(schema.papers.publishedAt))
    .limit(Math.max(limit, 10));

  const filtered = since
    ? recent.filter((p) => (p.publishedAt ? new Date(p.publishedAt).getTime() >= since.getTime() : false))
    : recent;

  // You could refine by checking existence of related rows, but simple approach works for MVP
  return filtered.slice(0, limit);
}

/* ========== ar5iv GitHub extraction ========== */

async function fetchAr5ivGitHubUrls(baseId: string): Promise<string[]> {
  // ar5iv serves HTML without scripts; we can scan for hrefs via regex
  const url = `https://ar5iv.org/html/${encodeURIComponent(baseId)}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        process.env.ARXIV_USER_AGENT ||
        `ronbun/0.1 (+${process.env.APP_URL ?? "https://example.com"}; cron/enrich)`,
      Accept: "text/html,application/xhtml+xml",
    },
    cache: "no-store",
  });
  if (!res.ok) return [];
  const html = await res.text();

  // Capture href="https://github.com/..." or '//github.com/...'
  const urls = new Set<string>();
  const re = /href\s*=\s*["']([^"']*github\.com\/[^"'\s#]+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const raw = m[1];
    // Normalize protocol-less URLs
    const u = raw.startsWith("//") ? `https:${raw}` : raw;
    // Strip trailing punctuation
    const cleaned = u.replace(/[),.;]+$/g, "");
    urls.add(cleaned);
  }
  return Array.from(urls);
}

function pickPrimaryRepo(urls: string[] | null | undefined) {
  if (!urls || urls.length === 0) return null;
  for (const u of urls) {
    const id = parseGitHubRepo(u);
    if (id) return id;
  }
  return null;
}

/* ========== Helpers ========== */

function json(body: unknown, status = 200, headers?: Record<string, string>) {
  return new NextResponse(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...(headers || {}) },
  });
}

function stripVersion(arxivId: string) {
  return String(arxivId).replace(/v\d+$/i, "");
}

function clampInt(v: string | null, def: number, min: number, max: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

function asBool(v: string | null, def: boolean): boolean {
  if (v == null) return def;
  const s = v.toLowerCase();
  return s === "1" || s === "true" || s === "yes";
}

function dedupe<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}