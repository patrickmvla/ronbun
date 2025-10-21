/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/compare/route.ts
import { NextResponse } from "next/server";
import { db, schema } from "@/lib/drizzle/db";
import { inArray, eq, desc, asc } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ScoreComponents = { recency: number; code: number; stars: number; watchlist: number };

type CompareItem = {
  arxivId: string;
  found: boolean;

  // Basic
  title?: string;
  authors?: string[];
  categories?: string[];
  published?: string;
  updated?: string;
  pdfUrl?: string | null;

  // Enrichment
  codeUrls?: string[];
  repoStars?: number | null;
  hasWeights?: boolean;

  // Structured
  method?: string | null;
  tasks?: string[];
  datasets?: string[];
  benchmarks?: string[];
  claimedSota?: number;

  // Score + links
  score?: { global: number; components?: ScoreComponents | null };
  links?: { abs: string | null; pwc: string | null; repo: string | null };
};

const MAX_IDS = 2;

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const idsParam = (url.searchParams.get("ids") || "").trim();

    if (!idsParam) {
      return json({ error: "Missing ids (?ids=2501.10000,2501.10011)" }, 400);
    }

    // Normalize inputs: raw ID, ID with version, or abs/pdf URLs
    const requestedRaw = idsParam
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, MAX_IDS);

    const requested = requestedRaw
      .map((s) => normalizeArxivId(s))
      .filter((v): v is string => Boolean(v));

    if (requested.length === 0) {
      return json({ error: "Provide 1–2 valid arXiv IDs" }, 400);
    }

    // Query using unique IDs but keep requested order for payload
    const uniqueIds = Array.from(new Set(requested));

    // 1) Fetch papers by arXiv base ID
    const papers = await db
      .select()
      .from(schema.papers)
      .where(inArray(schema.papers.arxivIdBase, uniqueIds));

    const byArxivId = new Map<string, (typeof papers)[number]>();
    for (const p of papers) byArxivId.set(p.arxivIdBase, p);

    const paperIds = papers.map((p) => p.id);
    if (paperIds.length === 0) {
      return json({
        items: requested.map((id) => ({ arxivId: id, found: false } as CompareItem)),
      });
    }

    // 2) Authors for all (ordered: paperId + position)
    const authorRows = await db
      .select({
        paperId: schema.paperAuthors.paperId,
        name: schema.authors.name,
        position: schema.paperAuthors.position,
      })
      .from(schema.paperAuthors)
      .innerJoin(schema.authors, eq(schema.paperAuthors.authorId, schema.authors.id))
      .where(inArray(schema.paperAuthors.paperId, paperIds))
      .orderBy(asc(schema.paperAuthors.paperId), asc(schema.paperAuthors.position));

    const authorsByPaper = new Map<string, string[]>();
    for (const row of authorRows) {
      const list = authorsByPaper.get(row.paperId) ?? [];
      list.push(row.name);
      authorsByPaper.set(row.paperId, list);
    }

    // 3) Enrichment (latest per paper)
    const enrichRows = await db
      .select()
      .from(schema.paperEnrich)
      .where(inArray(schema.paperEnrich.paperId, paperIds))
      .orderBy(desc(schema.paperEnrich.updatedAt));
    const enrichByPaper = pickLatestBy(enrichRows, "paperId", "updatedAt");

    // 4) Structured (latest per paper)
    const structuredRows = await db
      .select()
      .from(schema.paperStructured)
      .where(inArray(schema.paperStructured.paperId, paperIds))
      .orderBy(desc(schema.paperStructured.createdAt));
    const structuredByPaper = pickLatestBy(structuredRows, "paperId", "createdAt");

    // 5) Scores (single row per paper)
    const scoreRows = await db
      .select()
      .from(schema.paperScores)
      .where(inArray(schema.paperScores.paperId, paperIds));
    const scoreByPaper = new Map<string, (typeof scoreRows)[number]>();
    for (const s of scoreRows) scoreByPaper.set(s.paperId, s);

    // 6) PwC (latest)
    const pwcRows = await db
      .select()
      .from(schema.pwcLinks)
      .where(inArray(schema.pwcLinks.paperId, paperIds))
      .orderBy(desc(schema.pwcLinks.updatedAt));
    const pwcByPaper = pickLatestBy(pwcRows, "paperId", "updatedAt");

    // 7) Build payload in the order of requested IDs
    const items: CompareItem[] = requested.map((baseId) => {
      const p = byArxivId.get(baseId);
      if (!p) return { arxivId: baseId, found: false };

      const authors = authorsByPaper.get(p.id) ?? [];
      const enrich = enrichByPaper.get(p.id) ?? null;
      const structured = structuredByPaper.get(p.id) ?? null;
      const score = scoreByPaper.get(p.id) ?? null;
      const pwc = pwcByPaper.get(p.id) ?? null;

      const codeUrls = dedupe([...(enrich?.codeUrls ?? []), ...(structured?.codeUrls ?? [])]);

      return {
        arxivId: p.arxivIdBase,
        found: true,

        title: p.title,
        authors,
        categories: p.categories ?? [],
        published: toIso(p.publishedAt),
        updated: toIso(p.updatedAt ?? p.publishedAt),
        pdfUrl:
          p.pdfUrl ??
          (p.arxivIdBase ? `https://arxiv.org/pdf/${p.arxivIdBase}.pdf` : null),

        codeUrls,
        repoStars:
          enrich?.repoStars ??
          (typeof pwc?.repoStars === "number" ? pwc.repoStars : null),
        hasWeights: Boolean(enrich?.hasWeights),

        method: structured?.method ?? null,
        tasks: structured?.tasks ?? [],
        datasets: structured?.datasets ?? [],
        benchmarks: structured?.benchmarks ?? [],
        claimedSota: Array.isArray(structured?.claimedSota)
          ? structured!.claimedSota.length
          : 0,

        score: score
          ? {
              global: Number(score.globalScore ?? 0),
              components: (score.components as ScoreComponents) ?? null,
            }
          : undefined,

        links: {
          abs:
            p.absUrl ??
            (p.arxivIdBase ? `https://arxiv.org/abs/${p.arxivIdBase}` : null),
          pwc: pwc?.paperUrl ?? null,
          repo: enrich?.primaryRepo ?? pwc?.repoUrl ?? null,
        },
      };
    });

    return json(
      { items },
      200,
      { "Cache-Control": "public, s-maxage=90, stale-while-revalidate=60" }
    );
  } catch (err: any) {
    return json({ error: err?.message || "Failed to compare papers" }, 500);
  }
}

/* ========== Helpers ========== */

function json(body: unknown, status = 200, headers?: Record<string, string>) {
  return new NextResponse(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...(headers || {}),
    },
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

function toIso(d: unknown): string {
  try {
    // Prefer numeric time if Date-like
    const ms = toMs(d);
    return Number.isFinite(ms) ? new Date(ms).toISOString() : new Date().toISOString();
  } catch {
    return new Date().toISOString();
  }
}

function dedupe<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

// Safe timestamp extraction without instanceof on generic indexed values
function toMs(v: unknown): number {
  try {
    if (v && typeof v === "object" && typeof (v as any).getTime === "function") {
      const n = (v as any as Date).getTime();
      if (Number.isFinite(n)) return n;
    }
    const n = new Date(String(v)).getTime();
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

// Pick the most recent row per key based on a timestamp column (no instanceof)
function pickLatestBy<T extends Record<string, unknown>>(
  rows: T[],
  key: keyof T,
  ts: keyof T
): Map<string, T> {
  const map = new Map<string, T>();
  for (const r of rows) {
    const id = String(r[key] as any);
    const prev = map.get(id);
    if (!prev) {
      map.set(id, r);
      continue;
    }
    const tPrev = toMs(prev[ts as keyof T]);
    const tCur = toMs(r[ts as keyof T]);
    if (tCur >= tPrev) map.set(id, r);
  }
  return map;
}