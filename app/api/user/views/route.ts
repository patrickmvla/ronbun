/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/user/views/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { desc, eq, sql, and } from "drizzle-orm";
import { db, schema } from "@/lib/drizzle/db";
import { requireAuth, getAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ViewBodySchema = z.object({
  arxivId: z.string().min(6),
  source: z.enum(["feed", "search", "digest", "direct", "similar"]).default("feed"),
  durationMs: z.number().int().positive().optional(),
});

/**
 * POST /api/user/views
 * Record a paper view.
 * Body: { arxivId: string, source?: string, durationMs?: number }
 */
export async function POST(req: Request) {
  try {
    const { user } = await requireAuth();
    const body = await req.json().catch(() => ({}));
    const parsed = ViewBodySchema.safeParse(body);

    if (!parsed.success) {
      return json({ error: "Invalid input", issues: parsed.error.flatten() }, 400);
    }

    const baseId = stripVersion(parsed.data.arxivId);

    // Find paper
    const paper = await db.query.papers.findFirst({
      where: (p, { eq }) => eq(p.arxivIdBase, baseId),
      columns: { id: true, arxivIdBase: true, categories: true },
    });

    if (!paper) {
      return json({ error: "Paper not found" }, 404);
    }

    // Insert view record
    const [view] = await db
      .insert(schema.paperViews)
      .values({
        userId: user.id,
        paperId: paper.id,
        source: parsed.data.source,
        durationMs: parsed.data.durationMs,
        arxivIdBase: paper.arxivIdBase,
      })
      .returning({
        id: schema.paperViews.id,
        viewedAt: schema.paperViews.viewedAt,
      });

    // Async: Update user interests from this view (fire and forget)
    updateUserInterestsFromView(user.id, paper.id, paper.categories).catch(console.error);

    return json({ ok: true, view: { id: view.id, viewedAt: view.viewedAt } }, 201);
  } catch (err: any) {
    return handleError(err);
  }
}

/**
 * GET /api/user/views?limit=20&cursor=<timestamp>
 * Returns user's recent paper views (reading history).
 */
export async function GET(req: Request) {
  try {
    const auth = await getAuth();
    if (!auth?.user) {
      return json({ items: [], nextCursor: null });
    }

    const url = new URL(req.url);
    const limit = clamp(Number(url.searchParams.get("limit") || 20), 1, 100);
    const cursor = url.searchParams.get("cursor"); // ISO timestamp

    // Build query with optional cursor
    let whereClause = eq(schema.paperViews.userId, auth.user.id);
    if (cursor) {
      whereClause = and(
        eq(schema.paperViews.userId, auth.user.id),
        sql`${schema.paperViews.viewedAt} < ${new Date(cursor)}`
      )!;
    }

    const rows = await db
      .select({
        id: schema.paperViews.id,
        arxivId: schema.paperViews.arxivIdBase,
        viewedAt: schema.paperViews.viewedAt,
        source: schema.paperViews.source,
        title: schema.papers.title,
      })
      .from(schema.paperViews)
      .innerJoin(schema.papers, eq(schema.paperViews.paperId, schema.papers.id))
      .where(whereClause)
      .orderBy(desc(schema.paperViews.viewedAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit);
    const nextCursor =
      hasMore && items.length > 0
        ? items[items.length - 1].viewedAt?.toISOString()
        : null;

    return json({
      items: items.map((r) => ({
        id: r.id,
        arxivId: r.arxivId,
        title: r.title,
        viewedAt: r.viewedAt?.toISOString(),
        source: r.source,
      })),
      nextCursor,
    });
  } catch (err: any) {
    return handleError(err);
  }
}

/* ========== Helpers ========== */

async function updateUserInterestsFromView(
  userId: string,
  paperId: string,
  categories: string[] | null
) {
  if (!categories?.length) return;

  // Upsert category interests
  for (const cat of categories) {
    await db
      .insert(schema.userInterests)
      .values({
        userId,
        type: "category",
        value: cat,
        normValue: cat.toLowerCase(),
        viewCount: 1,
        source: "implicit",
        score: "0.1", // Initial score
      })
      .onConflictDoUpdate({
        target: [
          schema.userInterests.userId,
          schema.userInterests.type,
          schema.userInterests.value,
        ],
        set: {
          viewCount: sql`${schema.userInterests.viewCount} + 1`,
          updatedAt: new Date(),
          // Score formula: tanh(viewCount / 10) gives 0..1 with diminishing returns
          score: sql`ROUND(CAST(0.7 * TANH((COALESCE(${schema.userInterests.viewCount}, 0) + 1) / 10.0) AS numeric), 4)`,
        },
      });
  }
}

function stripVersion(id: string) {
  return String(id || "").replace(/v\d+$/i, "");
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function json(body: unknown, status = 200) {
  return new NextResponse(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function handleError(err: any) {
  if (err?.status === 401) return json({ error: "Unauthorized" }, 401);
  console.error("[views]", err);
  return json({ error: err?.message || "Server error" }, 500);
}
