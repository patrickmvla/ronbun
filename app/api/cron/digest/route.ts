/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/cron/digest/route.ts
// Weekly/daily digest generator and sender.
// - Protected by CRON_SECRET
// - For each user with watchlists, select top papers from the last N days that match their watchlists
// - Optionally create digest rows, and/or send emails using lib/email.ts
//
// Query params (all optional):
//   days=7                Lookback window (default 7)
//   per=8                 Max items per user (default 8)
//   users=<csv>           Restrict to specific user IDs (comma-separated UUIDs)
//   dry=1                 Compute only, do not write or send (default 0)
//   schedule=1            Create digests rows (status='scheduled') instead of sending immediately (default 0)
//   send=1                Send emails immediately (default 0)
//   limitUsers=100        Cap number of users to process (default 200)
//   at=ISO                Schedule/Send time reference (defaults to now)
//
// Notes:
// - Email sending requires a valid provider and user email lookup from auth.users.
// - If email lookup fails for a user, we still create the digest row (when schedule=1).

import { NextResponse } from "next/server";
import { db, schema } from "@/lib/drizzle/db";
import { desc, eq, inArray } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { assertCronSecret } from "@/lib/auth";
import { sendDigestEmail, type DigestItem } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_DAYS = 7;
const DEFAULT_PER = 8;
const DEFAULT_LIMIT_USERS = 200;

export async function POST(req: Request) {
  const startedAt = new Date();

  try {
    assertCronSecret(req);

    const url = new URL(req.url);
    const days = clampInt(url.searchParams.get("days"), DEFAULT_DAYS, 1, 60);
    const per = clampInt(url.searchParams.get("per"), DEFAULT_PER, 1, 50);
    const dry = asBool(url.searchParams.get("dry"), false);
    const schedule = asBool(url.searchParams.get("schedule"), false);
    const sendNow = asBool(url.searchParams.get("send"), false);
    const limitUsers = clampInt(
      url.searchParams.get("limitUsers"),
      DEFAULT_LIMIT_USERS,
      1,
      1000
    );
    const atParam = url.searchParams.get("at");
    const at = toDate(atParam) ?? new Date();

    const usersParam = (url.searchParams.get("users") || "").trim();
    const userIds = usersParam
      ? usersParam
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : await getUserIdsWithWatchlists(limitUsers);

    const results: Array<{
      userId: string;
      email?: string | null;
      count: number;
      scheduled?: boolean;
      sent?: boolean;
      error?: string;
    }> = [];

    if (userIds.length === 0) {
      return json({
        startedAt,
        finishedAt: new Date(),
        params: { days, per, dry, schedule, send: sendNow, limitUsers },
        usersProcessed: 0,
        results,
      });
    }

    // Preload = select recent candidate papers (common pool) to filter per user
    const since = new Date(at.getTime() - days * 24 * 60 * 60 * 1000);
    const candidates = await getRecentCandidates(since, 400); // cap pool per digest run
    const candidateIds = candidates.map((c) => c.id);

    const structuredByPaper = await getLatestStructuredByPaper(candidateIds);
    const scoresByPaper = await getScoresByPaper(candidateIds);
    const authorsByPaper = await getAuthorsByPaper(candidateIds); // new: author matching

    for (const userId of userIds) {
      try {
        const watchlists = await getWatchlists(userId);
        if (!watchlists.length) {
          results.push({ userId, count: 0 });
          continue;
        }

        // Rank candidates per user by watchlist matches + global score
        const ranked = rankForUser(
          candidates,
          structuredByPaper,
          scoresByPaper,
          authorsByPaper,
          watchlists
        );
        const top = ranked.slice(0, per);

        if (top.length === 0) {
          results.push({ userId, count: 0 });
          continue;
        }

        // Build digest items and DB items
        const appUrl =
          (process.env.APP_URL || "").replace(/\/+$/, "") ||
          "http://localhost:3000";
        const digestItems: DigestItem[] = top.map((t) =>
          toDigestItem(
            t.paper,
            t.reason,
            appUrl,
            structuredByPaper.get(t.paper.id)?.benchmarks || [],
            authorsByPaper.get(t.paper.id) || []
          )
        );
        const dbItems = top.map((t) => ({
          paperId: t.paper.id,
          reason: t.reason,
        }));

        // Write digest row if schedule requested
        let scheduled = false;
        if (schedule && !dry) {
          await db.insert(schema.digests).values({
            userId,
            scheduledFor: at,
            items: dbItems as any,
            status: "scheduled",
          });
          scheduled = true;
        }

        // Optional immediate send (requires email)
        let sent = false;
        let email: string | null | undefined = undefined;
        if (sendNow && !dry) {
          email = await getUserEmail(userId).catch(() => null);
          if (email) {
            await sendDigestEmail({
              to: email,
              userName: await getUserDisplayName(userId),
              items: digestItems,
              appUrl,
              unsubscribeUrl: `${appUrl}/settings/account`,
            });
            sent = true;
          }
        }

        results.push({ userId, email, count: top.length, scheduled, sent });
      } catch (e: any) {
        results.push({ userId, count: 0, error: e?.message || "error" });
      }
    }

    return json(
      {
        startedAt,
        finishedAt: new Date(),
        params: { days, per, dry, schedule, send: sendNow, limitUsers },
        usersProcessed: userIds.length,
        results,
      },
      200
    );
  } catch (err: any) {
    return json({ error: err?.message || "Digest failed" }, err?.status || 500);
  }
}

/* ========== Selection & ranking ========== */

async function getUserIdsWithWatchlists(limit: number): Promise<string[]> {
  const rows = await db
    .select({ userId: schema.watchlists.userId })
    .from(schema.watchlists);
  // drizzle doesn't support distinct on easily; dedupe in code
  const ids = Array.from(new Set(rows.map((r) => r.userId))).slice(0, limit);
  return ids;
}

async function getWatchlists(userId: string) {
  const rows = await db
    .select({
      type: schema.watchlists.type,
      terms: schema.watchlists.terms,
      categories: schema.watchlists.categories,
    })
    .from(schema.watchlists)
    .where(eq(schema.watchlists.userId, userId));
  return rows.map((r) => ({
    type: r.type as "keyword" | "author" | "benchmark" | "institution",
    terms: Array.isArray(r.terms) ? r.terms.map(String) : [],
    categories: Array.isArray(r.categories) ? r.categories.map(String) : [],
  }));
}

type PaperRow = typeof schema.papers.$inferSelect;
type StructuredRow = typeof schema.paperStructured.$inferSelect;
type ScoreRow = typeof schema.paperScores.$inferSelect;

async function getRecentCandidates(
  since: Date,
  cap: number
): Promise<PaperRow[]> {
  // Top-N recent papers since date
  const rows = await db
    .select()
    .from(schema.papers)
    .where(sql`${schema.papers.publishedAt} >= ${since}`)
    .orderBy(desc(schema.papers.publishedAt))
    .limit(cap);
  return rows;
}

async function getLatestStructuredByPaper(paperIds: string[]) {
  if (paperIds.length === 0) return new Map<string, StructuredRow>();
  const rows = await db
    .select()
    .from(schema.paperStructured)
    .where(inArray(schema.paperStructured.paperId, paperIds))
    .orderBy(desc(schema.paperStructured.createdAt));
  const map = new Map<string, StructuredRow>();
  for (const r of rows) {
    if (!map.has(r.paperId)) map.set(r.paperId, r); // first row per paper (latest)
  }
  return map;
}

async function getScoresByPaper(paperIds: string[]) {
  if (paperIds.length === 0) return new Map<string, ScoreRow>();
  const rows = await db
    .select()
    .from(schema.paperScores)
    .where(inArray(schema.paperScores.paperId, paperIds));
  const map = new Map<string, ScoreRow>();
  for (const r of rows) map.set(r.paperId, r);
  return map;
}

async function getAuthorsByPaper(paperIds: string[]) {
  if (paperIds.length === 0) return new Map<string, string[]>();
  const rows = await db
    .select({
      paperId: schema.paperAuthors.paperId,
      name: schema.authors.name,
      position: schema.paperAuthors.position,
    })
    .from(schema.paperAuthors)
    .innerJoin(
      schema.authors,
      eq(schema.paperAuthors.authorId, schema.authors.id)
    )
    .where(inArray(schema.paperAuthors.paperId, paperIds))
    .orderBy(schema.paperAuthors.paperId, schema.paperAuthors.position);
  const map = new Map<string, string[]>();
  for (const r of rows) {
    const arr = map.get(r.paperId) ?? [];
    arr.push(r.name);
    map.set(r.paperId, arr);
  }
  return map;
}

function rankForUser(
  candidates: PaperRow[],
  structuredByPaper: Map<string, StructuredRow>,
  scoresByPaper: Map<string, ScoreRow>,
  authorsByPaper: Map<string, string[]>,
  watchlists: Array<{ type: string; terms: string[]; categories?: string[] }>
): Array<{ paper: PaperRow; reason: string; score: number }> {
  const arr: Array<{ paper: PaperRow; reason: string; score: number }> = [];

  for (const p of candidates) {
    // Basic category filtering (if any watchlist has category restriction, accept if it matches any)
    const wlFiltered = watchlists.filter(
      (wl) =>
        !wl.categories?.length ||
        wl.categories.some((c) => (p.categories ?? []).includes(c))
    );
    if (wlFiltered.length === 0) continue;

    const text = `${(p.title || "").toLowerCase()} ${(
      p.abstract || ""
    ).toLowerCase()}`;
    const structured = structuredByPaper.get(p.id);
    const benchmarks = (structured?.benchmarks ?? []).map((b: string) =>
      String(b).toLowerCase()
    );
    const authors = (authorsByPaper.get(p.id) ?? []).map(normalizeName);

    let points = 0;
    const hits: string[] = [];

    for (const wl of wlFiltered) {
      for (const termRaw of wl.terms) {
        const term = termRaw.trim();
        if (!term) continue;

        if (wl.type === "author") {
          if (authors.includes(normalizeName(term))) {
            points += 1.2;
            hits.push(`Author: ${term}`);
          }
        } else if (wl.type === "benchmark") {
          const t = term.toLowerCase();
          if (benchmarks.includes(t) || includesToken(text, t)) {
            points += 1.1;
            hits.push(`Benchmark: ${term}`);
          }
        } else {
          // keyword or institution
          const t = term.toLowerCase();
          if (includesToken(text, t)) {
            points += 1.0;
            hits.push(`Keyword: ${term}`);
          }
        }
      }
    }

    if (points <= 0) continue;

    const scoreRow = scoresByPaper.get(p.id);
    const global = scoreRow ? Number(scoreRow.globalScore || 0) : 0;
    const composite = points + 0.3 * global;

    arr.push({
      paper: p,
      score: composite,
      reason: hits.slice(0, 4).join(", "),
    });
  }

  // Sort by composite desc, then published desc
  arr.sort(
    (a, b) =>
      b.score - a.score || toMs(b.paper.publishedAt) - toMs(a.paper.publishedAt)
  );
  return arr;
}

/* ========== Email & DB helpers ========== */

function toDigestItem(
  p: PaperRow,
  reason: string,
  appUrl: string,
  benchmarks: string[],
  authors: string[]
): DigestItem {
  const baseId = p.arxivIdBase;
  return {
    title: p.title,
    arxivId: baseId,
    authors,
    categories: p.categories ?? [],
    published: p.publishedAt
      ? new Date(p.publishedAt as any).toISOString()
      : undefined,
    quickTake: undefined,
    reason,
    score: undefined,
    links: {
      paper: `${appUrl}/paper/${baseId}`,
      abs: p.absUrl ?? `https://arxiv.org/abs/${baseId}`,
      pdf: p.pdfUrl ?? `https://arxiv.org/pdf/${baseId}.pdf`,
      code: null,
      pwc: null,
    },
    badges: {
      benchmarks,
    },
  };
}

async function getUserEmail(userId: string): Promise<string | null> {
  // Query Supabase auth.users.email
  try {
    const rows = await db.execute<{ id: string; email: string }>(
      sql`select id, email from auth.users where id = ${userId} limit 1`
    );
    const row = Array.isArray(rows) ? rows[0] : (rows as any)?.rows?.[0];
    const email =
      row?.email ??
      (Array.isArray((rows as any)?.rows)
        ? (rows as any).rows[0]?.email
        : null);
    return email || null;
  } catch {
    return null;
  }
}

async function getUserDisplayName(userId: string): Promise<string | null> {
  try {
    const row = await db.query.profiles.findFirst({
      where: (p, { eq }) => eq(p.id, userId),
      columns: { displayName: true },
    });
    return row?.displayName ?? null;
  } catch {
    return null;
  }
}

/* ========== Small utils ========== */

function json(body: unknown, status = 200, headers?: Record<string, string>) {
  return new NextResponse(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...(headers || {}),
    },
  });
}

function clampInt(
  v: string | null,
  def: number,
  min: number,
  max: number
): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

function toDate(v?: string | null) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d : null;
}

function toMs(v: unknown): number {
  try {
    if (
      v &&
      typeof v === "object" &&
      typeof (v as any).getTime === "function"
    ) {
      const n = (v as any as Date).getTime();
      if (Number.isFinite(n)) return n;
    }
    const n = new Date(String(v)).getTime();
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function normalizeName(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function includesToken(hay: string, needle: string): boolean {
  if (!hay || !needle) return false;

  // Safely escape the user-provided term for RegExp.
  // This is the canonical escape set.
  const escaped = String(needle)
    .trim()
    .replace(/[\\^$.*+?()[```{}|]/g, "\\$&");

  try {
    // Prefer Unicode-aware token boundaries: non-letter/number/underscore
    // Requires the 'u' flag for \p{}.
    const re = new RegExp(
      `(^|[^\\p{L}\\p{N}_])${escaped}(?=[^\\p{L}\\p{N}_]|$)`,
      "iu"
    );
    return re.test(hay);
  } catch {
    // Fallback for environments without Unicode property escapes
    const re = new RegExp(
      `(^|[^A-Za-z0-9_])${escaped}(?=[^A-Za-z0-9_]|$)`,
      "i"
    );
    return re.test(hay);
  }
}

function asBool(v: string | null, def: boolean): boolean {
  if (v == null) return def;
  return v === "1" || v.toLowerCase() === "true" || v.toLowerCase() === "yes";
}
