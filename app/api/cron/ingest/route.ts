// app/api/cron/ingest/route.ts
// Ingest recent arXiv papers into Postgres (Supabase) via Drizzle.
// - Protected with CRON_SECRET (Authorization: Bearer <secret> or x-cron-secret header)
// - Iterates categories, fetches N pages per category, upserts papers/authors/joins/versions
// - Polite to arXiv (uses lib/arxiv polite fetch + small page sizes)

import { NextResponse } from "next/server";
import { db, schema } from "@/lib/drizzle/db";
import { eq, and } from "drizzle-orm";
import { searchArxiv, type ArxivItem } from "@/lib/arxiv";
import { assertCronSecret } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Defaults (can be overridden via query params)
const DEFAULT_CATS = ["cs.AI", "cs.LG", "cs.CL", "cs.CV", "cs.NE", "stat.ML"] as const;
const DEFAULT_PAGES = 2; // pages per category
const DEFAULT_PAGE_SIZE = 25; // max per page (keep polite)
const DEFAULT_DAYS = 3; // lookback window; set 0 to disable

export async function POST(req: Request) {
  let runId: string | null = null;
  const startedAt = new Date();
  let totalFetched = 0;
  let totalProcessed = 0;
  let notes: string[] = [];

  try {
    // Protect cron
    assertCronSecret(req);

    const url = new URL(req.url);
    const catsParam = url.searchParams.get("cats");
    const pagesParam = url.searchParams.get("pages");
    const sizeParam = url.searchParams.get("size") || url.searchParams.get("max");
    const daysParam = url.searchParams.get("days");

    const cats = catsParam
      ? catsParam.split(",").map((s) => s.trim()).filter(Boolean)
      : [...DEFAULT_CATS];

    const PAGES = clampInt(pagesParam, DEFAULT_PAGES, 1, 10);
    const PAGE_SIZE = clampInt(sizeParam, DEFAULT_PAGE_SIZE, 1, 50);
    const LOOKBACK_DAYS = clampInt(daysParam, DEFAULT_DAYS, 0, 30);

    notes.push(`cats=${cats.join("|")}`, `pages=${PAGES}`, `size=${PAGE_SIZE}`, `days=${LOOKBACK_DAYS}`);

    // Create run row
    const insertedRun = await db
      .insert(schema.ingestRuns)
      .values({
        status: "running",
        itemsFetched: 0,
        note: notes.join("; "),
      })
      .returning({ id: schema.ingestRuns.id });
    runId = insertedRun[0]?.id ?? null;

    const since = LOOKBACK_DAYS > 0 ? new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000) : null;

    // Main loop
    for (const cat of cats) {
      for (let page = 0; page < PAGES; page++) {
        const start = page * PAGE_SIZE;
        // Fetch arXiv
        const items = await searchArxiv({
          q: `cat:${cat}`,
          start,
          max: PAGE_SIZE,
          sortBy: "submittedDate",
          sortOrder: "descending",
        });

        totalFetched += items.length;
        if (items.length === 0) break;

        // Filter by lookback if configured
        const filtered = since
          ? items.filter((it) => new Date(it.published).getTime() >= since.getTime())
          : items;

        // Process each item
        for (const it of filtered) {
          const ok = await upsertPaperFromArxivItem(it, cat);
          if (ok) totalProcessed++;
        }

        // If lookback excludes the rest (older), stop paging this category early
        if (since && filtered.length < items.length) break;
      }
    }

    // Finish run
    await db
      .update(schema.ingestRuns)
      .set({
        finishedAt: new Date(),
        status: "ok",
        itemsFetched: totalProcessed,
        note: notes.join("; "),
      })
      .where(eq(schema.ingestRuns.id, runId!));

    return json(
      {
        runId,
        startedAt,
        finishedAt: new Date(),
        status: "ok",
        categories: cats,
        pages: PAGES,
        size: PAGE_SIZE,
        lookbackDays: LOOKBACK_DAYS,
        fetched: totalFetched,
        processed: totalProcessed,
      },
      200
    );
  } catch (err: any) {
    // Update run as failed
    if (runId) {
      try {
        await db
          .update(schema.ingestRuns)
          .set({
            finishedAt: new Date(),
            status: "failed",
            note: `${notes.join("; ")}; ${err?.message || "error"}`,
          })
          .where(eq(schema.ingestRuns.id, runId));
      } catch {
        // ignore
      }
    }
    return json({ error: err?.message || "Ingest failed" }, err?.status || 500);
  }
}

/* ========== Core upsert ========== */

async function upsertPaperFromArxivItem(item: ArxivItem, queryCat?: string): Promise<boolean> {
  const { baseId, version } = splitArxivId(item.arxivId);
  const categories = dedupe([
    ...(item.categories ?? []),
    ...(queryCat ? [queryCat] : []),
  ]);

  // Find existing paper by base ID
  const existing = await db.query.papers.findFirst({
    where: (p, { eq }) => eq(p.arxivIdBase, baseId),
  });

  let paperId: string;

  if (!existing) {
    // Insert paper
    const inserted = await db
      .insert(schema.papers)
      .values({
        arxivIdBase: baseId,
        latestVersion: version,
        title: item.title,
        abstract: item.summary,
        categories,
        primaryCategory: queryCat ?? categories[0] ?? null,
        publishedAt: toDate(item.published) ?? new Date(),
        updatedAt: toDate(item.updated) ?? toDate(item.published) ?? new Date(),
        pdfUrl: item.pdfUrl,
        absUrl: `https://arxiv.org/abs/${baseId}`,
      })
      .returning({ id: schema.papers.id });
    paperId = inserted[0].id;
  } else {
    paperId = existing.id;

    // Merge categories
    const mergedCats = dedupe([...(existing.categories ?? []), ...categories]);

    // Update if newer version or new metadata
    const newLatest = Math.max(Number(existing.latestVersion || 1), version);
    await db
      .update(schema.papers)
      .set({
        latestVersion: newLatest,
        title: item.title || existing.title,
        abstract: item.summary || existing.abstract,
        categories: mergedCats,
        primaryCategory: existing.primaryCategory ?? queryCat ?? mergedCats[0] ?? null,
        updatedAt: toDate(item.updated) ?? existing.updatedAt ?? existing.publishedAt,
        pdfUrl: item.pdfUrl ?? existing.pdfUrl,
        absUrl: existing.absUrl ?? `https://arxiv.org/abs/${baseId}`,
      })
      .where(eq(schema.papers.id, paperId));
  }

  // Insert version row if missing
  const haveVersion = await db.query.paperVersions.findFirst({
    where: (v, { and, eq }) => and(eq(v.paperId, paperId), eq(v.version, version)),
  });
  if (!haveVersion) {
    await db.insert(schema.paperVersions).values({
      paperId,
      version,
      title: item.title,
      abstract: item.summary,
      updatedAt: toDate(item.updated) ?? new Date(),
    });
  }

  // Authors (ordered)
  for (let i = 0; i < (item.authors?.length ?? 0); i++) {
    const name = item.authors![i]!;
    const norm = normalizeName(name);

    // Upsert author by name
    let authorId: string | null = null;
    const found = await db.query.authors.findFirst({
      where: (a, { eq }) => eq(a.name, name),
    });
    if (found) {
      authorId = found.id;
      // Try to backfill norm name if missing
      if (!found.normName) {
        await db
          .update(schema.authors)
          .set({ normName: norm })
          .where(eq(schema.authors.id, found.id));
      }
    } else {
      const inserted = await db
        .insert(schema.authors)
        .values({ name, normName: norm })
        .returning({ id: schema.authors.id });
      authorId = inserted[0].id;
    }

    // Join (ignore if exists)
    await db
      .insert(schema.paperAuthors)
      .values({ paperId, authorId, position: i })
      .onConflictDoNothing({ target: [schema.paperAuthors.paperId, schema.paperAuthors.authorId] });
  }

  return true;
}

/* ========== Helpers ========== */

function json(body: unknown, status = 200, headers?: Record<string, string>) {
  return new NextResponse(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...(headers || {}) },
  });
}

function clampInt(v: string | null, def: number, min: number, max: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

function splitArxivId(id: string): { baseId: string; version: number } {
  const m = id.match(/^(\d{4}\.\d{5})(?:v(\d+))?$/i);
  if (!m) return { baseId: id.replace(/v\d+$/i, ""), version: 1 };
  const baseId = m[1];
  const version = m[2] ? Number(m[2]) : 1;
  return { baseId, version };
}

function toDate(v: string | Date | null | undefined): Date | null {
  if (!v) return null;
  if (v instanceof Date) return Number.isFinite(v.getTime()) ? v : null;
  const d = new Date(String(v));
  return Number.isFinite(d.getTime()) ? d : null;
}

function normalizeName(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function dedupe<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}