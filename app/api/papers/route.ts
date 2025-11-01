/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/papers/route.ts
import { NextResponse } from "next/server";
import { db, schema } from "@/lib/drizzle/db";
import { desc, eq, inArray } from "drizzle-orm";
import { getAuth } from "@/lib/auth";
import { computePaperScore } from "@/lib/scoring";
import { watchlistsToScoringInput } from "@/lib/utils/watchlist-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ScoreComponents = {
  recency: number;
  code: number;
  stars: number;
  watchlist: number;
};

type PaperListItem = {
  arxivId: string;
  title: string;
  authors: string[];
  categories: string[];
  primaryCategory: string | null;
  published: string;
  updated: string;
  pdfUrl: string | null;

  // Enrichment
  codeUrls: string[];
  repoStars: number | null;
  hasWeights: boolean;

  // Structured
  method: string | null;
  tasks: string[];
  datasets: string[];
  benchmarks: string[];
  claimedSotaCount: number;

  // Score + links
  score?: { global: number; components?: ScoreComponents | null };
  links: { abs: string; pdf: string; repo: string | null; pwc: string | null };
};

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);

    // Try to get auth (optional - feed works without login)
    const auth = await getAuth().catch(() => null);
    const userId = auth?.user?.id ?? null;

    // Optional view; default = no time filter
    const viewParam = url.searchParams.get("view");
    const view: "today" | "week" | "for-you" | null =
      viewParam === "today" || viewParam === "week" || viewParam === "for-you"
        ? (viewParam as any)
        : null;

    const categories = (url.searchParams.get("categories") || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const codeOnly = asBool(url.searchParams.get("code"), false);
    const hasWeights = asBool(url.searchParams.get("weights"), false);
    const withBenchmarks = asBool(url.searchParams.get("benchmarks"), false);
    const limit = clampInt(url.searchParams.get("limit"), 25, 1, 50);
    const cursor = url.searchParams.get("cursor") || null; // format: "{tsIso}_{uuid}"

    // Fetch user watchlists if logged in
    let watchlists: any[] = [];
    if (userId) {
      watchlists = await db
        .select()
        .from(schema.watchlists)
        .where(eq(schema.watchlists.userId, userId));
    }

    // Time window based on view; null = no time filter
    const since: Date | null =
      view === "week"
        ? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        : view === "today"
        ? new Date(new Date().setHours(0, 0, 0, 0))
        : null;

    // Fetch base rows (typed where; no builder reassignments)
    let paperRows = await db.query.papers.findMany({
      where: (p, { and, gte, inArray }) =>
        and(
          since ? gte(p.publishedAt, since) : undefined,
          categories.length ? inArray(p.primaryCategory, categories) : undefined
        ),
      orderBy: (p, { desc }) => desc(p.publishedAt),
      limit: limit + 1, // fetch one extra to build nextCursor
    });

    // Cursor (client passes "{iso}_{uuid}")
    const parsedCursor = parseCursor(cursor);
    if (parsedCursor) {
      const { ts, id } = parsedCursor;
      paperRows = paperRows.filter(
        (p) =>
          new Date(p.publishedAt as any).getTime() < ts ||
          (new Date(p.publishedAt as any).getTime() === ts && String(p.id) < id)
      );
    }

    // Trim to 'limit' after filters
    paperRows = paperRows.slice(0, limit);

    if (!paperRows.length) {
      return json({ items: [], nextCursor: null }, 200, cache());
    }

    const paperIds = paperRows.map((p) => p.id);

    // Authors
    const aRows = await db
      .select({
        paperId: schema.paperAuthors.paperId,
        name: schema.authors.name,
        position: schema.paperAuthors.position,
      })
      .from(schema.paperAuthors)
      .innerJoin(schema.authors, eq(schema.paperAuthors.authorId, schema.authors.id))
      .where(inArray(schema.paperAuthors.paperId, paperIds))
      .orderBy(schema.paperAuthors.paperId, schema.paperAuthors.position);
    const authorsByPaper = new Map<string, string[]>();
    for (const r of aRows) {
      const arr = authorsByPaper.get(r.paperId) ?? [];
      arr.push(r.name);
      authorsByPaper.set(r.paperId, arr);
    }

    // Latest Enrich
    const enrichRows = await db
      .select()
      .from(schema.paperEnrich)
      .where(inArray(schema.paperEnrich.paperId, paperIds))
      .orderBy(desc(schema.paperEnrich.updatedAt));
    const enrichByPaper = pickLatestBy(enrichRows, "paperId", "updatedAt");

    // Latest Structured
    const structuredRows = await db
      .select()
      .from(schema.paperStructured)
      .where(inArray(schema.paperStructured.paperId, paperIds))
      .orderBy(desc(schema.paperStructured.createdAt));
    const structuredByPaper = pickLatestBy(structuredRows, "paperId", "createdAt");

    // Scores
    const scoreRows = await db
      .select()
      .from(schema.paperScores)
      .where(inArray(schema.paperScores.paperId, paperIds));
    const scoreByPaper = new Map<string, (typeof scoreRows)[number]>();
    for (const s of scoreRows) scoreByPaper.set(s.paperId, s);

    // Latest PwC mapping (optional)
    const pwcRows = await db
      .select()
      .from(schema.pwcLinks)
      .where(inArray(schema.pwcLinks.paperId, paperIds))
      .orderBy(desc(schema.pwcLinks.updatedAt));
    const pwcByPaper = pickLatestBy(pwcRows, "paperId", "updatedAt");

    // Apply filters based on enrichment data
    const filteredIds = paperIds.filter((pid) => {
      const e = enrichByPaper.get(pid);
      const st = structuredByPaper.get(pid);

      // Code filter
      if (codeOnly) {
        const codes = new Set([...(e?.codeUrls ?? []), ...(st?.codeUrls ?? [])]);
        if (codes.size === 0) return false;
      }

      // Weights filter
      if (hasWeights && !e?.hasWeights) {
        return false;
      }

      // Benchmarks filter
      if (withBenchmarks) {
        const benchmarks = st?.benchmarks ?? [];
        if (!Array.isArray(benchmarks) || benchmarks.length === 0) {
          return false;
        }
      }

      return true;
    });

    let filteredPapers = paperRows.filter((p) => filteredIds.includes(p.id));

    // For "for-you" view with watchlists, recompute scores live
    if (view === "for-you" && watchlists.length > 0) {
      const watchlistInputs = watchlistsToScoringInput(watchlists);
      const scoredPapers = filteredPapers.map((p) => {
        const enrich = enrichByPaper.get(p.id);
        const structured = structuredByPaper.get(p.id);

        // Compute fresh score with user watchlists
        const scoreResult = computePaperScore(
          {
            arxivId: p.arxivIdBase,
            title: p.title,
            abstract: p.abstract,
            authors: authorsByPaper.get(p.id) ?? [],
            categories: p.categories ?? [],
            publishedAt: p.publishedAt as any,
            codeUrls: [...(enrich?.codeUrls ?? []), ...(structured?.codeUrls ?? [])],
            hasWeights: enrich?.hasWeights ?? false,
            repoStars: (enrich?.repoStars as number | null) ?? null,
            benchmarks: structured?.benchmarks ?? [],
          },
          watchlistInputs
        );

        return { paper: p, score: scoreResult.global };
      });

      // Sort by newly computed score
      scoredPapers.sort((a, b) => b.score - a.score);
      filteredPapers = scoredPapers.map((sp) => sp.paper);
    } else if (view === "for-you") {
      // Fallback to DB scores if no watchlists
      filteredPapers = filteredPapers.sort((a, b) => {
        const scoreA = scoreByPaper.get(a.id);
        const scoreB = scoreByPaper.get(b.id);
        const globalA = Number(scoreA?.globalScore ?? 0);
        const globalB = Number(scoreB?.globalScore ?? 0);
        return globalB - globalA; // descending
      });
    }

    const items: PaperListItem[] = filteredPapers.map((p) => {
      const authors = authorsByPaper.get(p.id) ?? [];
      const enrich = enrichByPaper.get(p.id) ?? null;
      const structured = structuredByPaper.get(p.id) ?? null;
      const score = scoreByPaper.get(p.id) ?? null;
      const pwc = pwcByPaper.get(p.id) ?? null;

      const codeUrls = dedupe([...(enrich?.codeUrls ?? []), ...(structured?.codeUrls ?? [])]);

      return {
        arxivId: p.arxivIdBase,
        title: p.title,
        authors,
        categories: p.categories ?? [],
        primaryCategory: p.primaryCategory ?? null,
        published: toIso(p.publishedAt),
        updated: toIso(p.updatedAt ?? p.publishedAt),
        pdfUrl: p.pdfUrl ?? (p.arxivIdBase ? `https://arxiv.org/pdf/${p.arxivIdBase}.pdf` : null),

        codeUrls,
        repoStars: (enrich?.repoStars as number | null) ?? null,
        hasWeights: Boolean(enrich?.hasWeights),

        method: structured?.method ?? null,
        tasks: structured?.tasks ?? [],
        datasets: structured?.datasets ?? [],
        benchmarks: structured?.benchmarks ?? [],
        claimedSotaCount: Array.isArray(structured?.claimedSota) ? structured!.claimedSota.length : 0,

        score: score
          ? {
              global: Number(score.globalScore ?? 0),
              components: (score.components as ScoreComponents) ?? null,
            }
          : undefined,

        links: {
          abs: p.absUrl ?? `https://arxiv.org/abs/${p.arxivIdBase}`,
          pdf: p.pdfUrl ?? `https://arxiv.org/pdf/${p.arxivIdBase}.pdf`,
          repo: enrich?.primaryRepo ?? null,
          pwc: pwc?.paperUrl ?? null,
        },
      };
    });

    // Next cursor
    const last = filteredPapers[filteredPapers.length - 1];
    const nextCursor =
      last && last.publishedAt
        ? `${new Date(last.publishedAt as any).toISOString()}_${last.id}`
        : null;

    return json({ items, nextCursor }, 200, cache());
  } catch (err: any) {
    return json({ error: err?.message || "Failed to load feed" }, 500);
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

function cache() {
  return { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=60" };
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

function toIso(d: unknown): string {
  try {
    if (d instanceof Date) return Number.isFinite(d.getTime()) ? d.toISOString() : new Date().toISOString();
    const x = new Date(String(d));
    return Number.isFinite(x.getTime()) ? x.toISOString() : new Date().toISOString();
  } catch {
    return new Date().toISOString();
  }
}

function parseCursor(c: string | null) {
  if (!c) return null;
  const [ts, id] = c.split("_");
  const t = new Date(ts).getTime();
  if (!Number.isFinite(t) || !id) return null;
  return { ts: t, id };
}

function dedupe<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

function pickLatestBy<T extends Record<string, any>>(rows: T[], key: keyof T, ts: keyof T) {
  const map = new Map<string, T>();
  for (const r of rows) {
    const id = String(r[key]);
    const prev = map.get(id);
    if (!prev) {
      map.set(id, r);
      continue;
    }
    const tPrev = new Date(String(prev[ts])).getTime();
    const tCur = new Date(String(r[ts])).getTime();
    if (tCur >= tPrev) map.set(id, r);
  }
  return map;
}