/* eslint-disable @typescript-eslint/no-explicit-any */
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

import { assertCronSecret } from "@/lib/auth";
import { db, schema } from "@/lib/drizzle/db";
import { fetchRepoMeta, fetchRepoReadme, parseGitHubRepo } from "@/lib/github";
import { lookupPwcByArxiv } from "@/lib/pwc";
import { computePaperScore, type PaperForScoring } from "@/lib/scoring";
import { ExtractedLLM, type TExtractedLLM } from "@/lib/zod";
import { groq } from "@ai-sdk/groq";
import { generateObject } from "ai";
import { desc, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Defaults (override via query params)
const DEFAULT_LIMIT = 30; // papers to process
const DEFAULT_SINCE_DAYS = 7; // consider papers updated/published within last N days
const DEFAULT_FETCH_README = false;
const DEFAULT_RUN_EXTRACT = true;
const DEFAULT_RUN_PWC = true;

// LLM model (Groq via AI SDK)
const EXTRACT_MODEL = process.env.GROQ_EXTRACT_MODEL || "llama-3.1-70b";
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

    // Optional: filter out those already enriched in the lookback window (best-effort)
    const since = sinceDays > 0 ? new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000) : null;
    const filtered = await filterAlreadyEnriched(candidates, since);

    // Process sequentially to be polite with external APIs
    for (const p of filtered) {
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
            repoStars = typeof meta.stars === "number" ? meta.stars : null;
            repoLicense = meta.license ?? null;
            if (doReadme) {
              const readme = await fetchRepoReadme(repoId.owner, repoId.repo).catch(() => null);
              if (readme?.text) {
                readmeExcerpt = readme.text.slice(0, 1200);
                readmeSha = readme.sha;
                hasWeights = /(?:checkpoint|weights|\.safetensors|\.pt|\.bin)/i.test(readme.text);
              }
            }
          } catch {
            // continue without meta
          }
        }

        // 3) Extract structured fields with LLM (optional, resilient)
        let extracted: TExtractedLLM | null = null;

        if (doExtract) {
          try {
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
          } catch {
            extracted = null; // skip extraction but keep enrichment pipeline running
          }
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
          hasWeights: typeof hasWeights === "boolean" ? hasWeights : null,
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

        // 7) Upsert PwC mapping row (ignore conflicts)
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
            .catch(() => undefined);
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
            hasWeights: typeof hasWeights === "boolean" ? hasWeights : null,
            repoStars:
              (typeof repoStars === "number" ? repoStars : null) ??
              (typeof pwc?.repoStars === "number" ? (pwc!.repoStars as number) : null),
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
        details.push({
          arxivId: baseId,
          ok: true,
          info: `${codeUrls.length} code urls${pwc ? "; pwc" : ""}`,
        });
      } catch (e: any) {
        details.push({ arxivId: baseId, ok: false, error: e?.message || "error" });
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
    .map((s) => normalizeArxivId(s))
    .filter((v): v is string => Boolean(v));

  if (ids.length === 0) return [];

  const rows = await db
    .select()
    .from(schema.papers)
    .where(inArray(schema.papers.arxivIdBase, Array.from(new Set(ids))))
    .orderBy(desc(schema.papers.publishedAt));

  return rows;
}

async function getRecentCandidates(limit: number, sinceDays: number) {
  const since =
    sinceDays > 0 ? new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000) : null;

  const rows = await db.query.papers.findMany({
    where: (p, { gte }) => (since ? gte(p.publishedAt, since) : undefined),
    orderBy: (p, { desc }) => desc(p.publishedAt),
    limit: Math.max(limit, 10),
  });

  return rows;
}

// Skip candidates already enriched recently (best-effort)
async function filterAlreadyEnriched(candidates: typeof schema.papers.$inferSelect[], since: Date | null) {
  if (!since || candidates.length === 0) return candidates.slice(0);
  const ids = candidates.map((c) => c.id);
  const rows = await db
    .select({
      paperId: schema.paperEnrich.paperId,
      updatedAt: schema.paperEnrich.updatedAt,
    })
    .from(schema.paperEnrich)
    .where(inArray(schema.paperEnrich.paperId, ids))
    .orderBy(desc(schema.paperEnrich.updatedAt));

  const latestByPaper = new Map<string, Date>();
  for (const r of rows) {
    const prev = latestByPaper.get(r.paperId);
    const cur = r.updatedAt ? new Date(r.updatedAt as any) : null;
    if (cur && (!prev || cur.getTime() > prev.getTime())) {
      latestByPaper.set(r.paperId, cur);
    }
  }

  return candidates.filter((c) => {
    const last = latestByPaper.get(c.id);
    if (!last) return true;
    return last.getTime() < since.getTime();
  });
}

/* ========== ar5iv GitHub extraction ========== */

async function fetchAr5ivGitHubUrls(baseId: string): Promise<string[]> {
  // ar5iv serves HTML without scripts; scan for hrefs
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

  // Capture href="...github.com/..." or '//github.com/...'
  const seen = new Set<string>();
  const re = /href\s*=\s*["']([^"']*github\.com\/[^"'\s#]+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const raw = m[1];
    const normalized = raw.startsWith("//") ? `https:${raw}` : raw;
    const cleaned = normalized.replace(/[),.;]+$/g, "");
    try {
      const u = new URL(cleaned, "https://ar5iv.org");
      if (u.hostname.endsWith("github.com")) {
        // Normalize to repo root when possible
        const repo = parseGitHubRepo(u.toString());
        if (repo) {
          seen.add(`https://github.com/${repo.owner}/${repo.repo}`);
        } else {
          seen.add(u.toString());
        }
      }
    } catch {
      // ignore invalid URLs
    }
  }
  return Array.from(seen);
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

// Accept raw ID, ID with version, or abs/pdf URLs; return base ID (e.g., "2501.12345")
function normalizeArxivId(input: string): string | null {
  const s = String(input).trim();
  if (!s) return null;
  const urlMatch = s.match(/arxiv\.org\/(?:abs|pdf)\/(\d{4}\.\d{5})(?:v\d+)?/i);
  const rawMatch = s.match(/^(\d{4}\.\d{5})(?:v\d+)?$/);
  const id = urlMatch?.[1] || rawMatch?.[1];
  return id ? stripVersion(id) : null;
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