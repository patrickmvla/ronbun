/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/cron/ingest/route.ts
import { NextResponse } from "next/server";
import { db, schema } from "@/lib/drizzle/db";
import { eq, inArray, and } from "drizzle-orm";
import { searchArxiv, type ArxivItem } from "@/lib/arxiv";
import { assertCronSecret } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_CATS = ["cs.AI", "cs.LG", "cs.CL", "cs.CV", "cs.NE", "stat.ML"] as const;
const DEFAULT_PAGES = 2;
const DEFAULT_PAGE_SIZE = 25;
const DEFAULT_DAYS = 3;

export async function POST(req: Request) {
  let runId: string | null = null;
  const startedAt = new Date();
  let totalFetched = 0;
  let totalProcessed = 0;
  const notes: string[] = [];

  try {
    assertCronSecret(req);

    const url = new URL(req.url);
    const catsParam = url.searchParams.get("cats");
    const pagesParam = url.searchParams.get("pages");
    const sizeParam = url.searchParams.get("size") || url.searchParams.get("max");
    const daysParam = url.searchParams.get("days");
    const pruneParam = url.searchParams.get("prune");
    const maxMsParam = url.searchParams.get("maxMs");
    const concurrencyParam = url.searchParams.get("concurrency");

    const cats = catsParam
      ? catsParam.split(",").map((s) => s.trim()).filter(Boolean)
      : [...DEFAULT_CATS];

    const PAGES = clampInt(pagesParam, DEFAULT_PAGES, 1, 10);
    const PAGE_SIZE = clampInt(sizeParam, DEFAULT_PAGE_SIZE, 1, 50);
    const LOOKBACK_DAYS = clampInt(daysParam, DEFAULT_DAYS, 0, 30);
    const PRUNE_AUTHORS = asBool(pruneParam, false);
    const MAX_MS = clampInt(maxMsParam, 45_000, 5_000, 5 * 60_000); // default 45s
    const CONCURRENCY = clampInt(concurrencyParam, 3, 1, 8); // default 3

    const deadline = Date.now() + MAX_MS;

    notes.push(
      `cats=${cats.join("|")}`,
      `pages=${PAGES}`,
      `size=${PAGE_SIZE}`,
      `days=${LOOKBACK_DAYS}`,
      `prune=${PRUNE_AUTHORS ? 1 : 0}`,
      `maxMs=${MAX_MS}`,
      `concurrency=${CONCURRENCY}`,
    );

    const insertedRun = await db
      .insert(schema.ingestRuns)
      .values({
        status: "running",
        itemsFetched: 0,
        note: notes.join("; "),
      })
      .returning({ id: schema.ingestRuns.id });
    runId = insertedRun[0]?.id ?? null;

    const since =
      LOOKBACK_DAYS > 0 ? new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000) : null;

    outer: for (const cat of cats) {
      for (let page = 0; page < PAGES; page++) {
        if (Date.now() > deadline) {
          notes.push(`deadline reached before fetch: cat=${cat}, page=${page}`);
          break outer;
        }

        const start = page * PAGE_SIZE;
        notes.push(`fetch cat=${cat} page=${page} start=${start}`);
        const items = await searchArxiv({
          q: `cat:${cat}`,
          start,
          max: PAGE_SIZE,
          sortBy: "submittedDate",
          sortOrder: "descending",
        });

        totalFetched += items.length;
        if (items.length === 0) {
          notes.push(`no more items cat=${cat} page=${page}`);
          break;
        }

        const filtered = since
          ? items.filter((it) => {
              const t = new Date(it.published).getTime();
              return Number.isFinite(t) && t >= since.getTime();
            })
          : items;

        // Dedupe by base arXiv ID across this page’s results to avoid double work
        const deduped = dedupeArxivItemsByBaseId(filtered);

        let processedHere = 0;
        let hitDeadline = false;

        await mapLimit(deduped, CONCURRENCY, async (it) => {
          if (Date.now() > deadline) {
            hitDeadline = true;
            return;
          }
          try {
            const ok = await upsertPaperFromArxivItem(it, cat, PRUNE_AUTHORS);
            if (ok) processedHere++;
          } catch (e: any) {
            notes.push(`err(${it.arxivId}): ${e?.message || "upsert error"}`);
          }
        });

        totalProcessed += processedHere;

        if (hitDeadline) {
          notes.push(`deadline reached during upsert: page=${page}`);
          break outer;
        }

        if (since && filtered.length < items.length) {
          notes.push(`hit lookback; stopping cat=${cat} at page=${page}`);
          break;
        }
      }
    }

    await db
      .update(schema.ingestRuns)
      .set({
        finishedAt: new Date(),
        status: "ok",
        itemsFetched: totalFetched,
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
        maxMs: MAX_MS,
        concurrency: CONCURRENCY,
        fetched: totalFetched,
        processed: totalProcessed,
        notes,
        errorsCount: notes.filter((n) => n.startsWith("err(")).length,
      },
      200
    );
  } catch (err: any) {
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

// Race-safe, idempotent upsert of paper + authors + version
async function upsertPaperFromArxivItem(
  item: ArxivItem,
  queryCat?: string,
  pruneAuthors = false
): Promise<boolean> {
  const { baseId, version } = splitArxivId(item.arxivId);
  const categories = dedupe([...(item.categories ?? []), ...(queryCat ? [queryCat] : [])]);

  // Try insert first (idempotent); if exists, patch
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
      pdfUrl: item.pdfUrl ?? null,
      absUrl: `https://arxiv.org/abs/${baseId}`,
    })
    .onConflictDoNothing({ target: schema.papers.arxivIdBase })
    .returning({ id: schema.papers.id });

  let paperId: string;

  if (inserted.length > 0) {
    // Fresh insert
    paperId = inserted[0].id;
  } else {
    // Already exists — fetch and patch selectively
    const existing = await db.query.papers.findFirst({
      where: (p, { eq }) => eq(p.arxivIdBase, baseId),
    });
    if (!existing) {
      // Extremely rare race; skip gracefully
      return false;
    }
    paperId = existing.id;

    const mergedCats = dedupe([...(existing.categories ?? []), ...categories]);
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
        pdfUrl: item.pdfUrl ?? existing.pdfUrl ?? null,
        absUrl: existing.absUrl ?? `https://arxiv.org/abs/${baseId}`,
      })
      .where(eq(schema.papers.id, paperId));
  }

  // Ensure authors in batch
  const names = Array.isArray(item.authors) ? item.authors : [];
  const authorMap = await ensureAuthors(names);

  // Join — upsert positions
  for (let i = 0; i < names.length; i++) {
    const authorId = authorMap.get(names[i]!)!;
    await db
      .insert(schema.paperAuthors)
      .values({ paperId, authorId, position: i })
      .onConflictDoUpdate({
        target: [schema.paperAuthors.paperId, schema.paperAuthors.authorId],
        set: { position: i },
      });
  }

  // Optionally prune authors no longer present
  if (pruneAuthors) {
    const rows = await db
      .select({ authorId: schema.paperAuthors.authorId })
      .from(schema.paperAuthors)
      .where(eq(schema.paperAuthors.paperId, paperId));

    const keepSet = new Set(names.map((n) => authorMap.get(n)!));
    const toRemove = rows.map((r) => r.authorId).filter((id) => !keepSet.has(id));
    if (toRemove.length > 0) {
      await db
        .delete(schema.paperAuthors)
        .where(and(eq(schema.paperAuthors.paperId, paperId), inArray(schema.paperAuthors.authorId, toRemove)))
        .catch(() => undefined);
    }
  }

  // Version row if missing
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

function dedupeArxivItemsByBaseId(items: ArxivItem[]): ArxivItem[] {
  const seen = new Set<string>();
  const out: ArxivItem[] = [];
  for (const it of items) {
    const { baseId } = splitArxivId(it.arxivId);
    if (!seen.has(baseId)) {
      seen.add(baseId);
      out.push(it);
    }
  }
  return out;
}

function asBool(v: string | null, def: boolean): boolean {
  if (v == null) return def;
  const s = v.toLowerCase();
  return s === "1" || s === "true" || s === "yes";
}

async function mapLimit<T>(
  arr: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<void>
): Promise<void> {
  if (arr.length === 0) return;
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, arr.length) }, () =>
    (async function worker() {
      while (true) {
        const idx = i++;
        if (idx >= arr.length) break;
        await fn(arr[idx]!, idx);
      }
    })()
  );
  await Promise.all(workers);
}

// Batch-create/find authors and return a map name -> id
async function ensureAuthors(names: string[]): Promise<Map<string, string>> {
  const uniqueNames = Array.from(new Set(names.filter(Boolean)));
  if (uniqueNames.length === 0) return new Map();

  const existing = await db
    .select({ id: schema.authors.id, name: schema.authors.name })
    .from(schema.authors)
    .where(inArray(schema.authors.name, uniqueNames));

  const have = new Map(existing.map((r) => [r.name, r.id]));
  const missing = uniqueNames.filter((n) => !have.has(n));

  if (missing.length > 0) {
    const inserted = await db
      .insert(schema.authors)
      .values(missing.map((name) => ({ name, normName: normalizeName(name) })))
      .onConflictDoNothing()
      .returning({ id: schema.authors.id, name: schema.authors.name });

    for (const r of inserted) have.set(r.name, r.id);

    // In extremely rare races, some missing rows may exist now; fetch them
    const stillMissing = missing.filter((n) => !have.has(n));
    if (stillMissing.length > 0) {
      const nowExisting = await db
        .select({ id: schema.authors.id, name: schema.authors.name })
        .from(schema.authors)
        .where(inArray(schema.authors.name, stillMissing));
      for (const r of nowExisting) have.set(r.name, r.id);
    }
  }

  return have;
}