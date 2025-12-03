/* eslint-disable @typescript-eslint/no-explicit-any */
// lib/implicit-interest.ts
// Compute implicit user interests from viewing patterns

import { db, schema } from "@/lib/drizzle/db";
import { eq, desc, gte, inArray, and } from "drizzle-orm";
import type { UserAffinities, ViewHistoryEntry } from "./scoring";

export type ComputeAffinitiesOptions = {
  lookbackDays?: number;
  decayHalfLifeDays?: number;
  minViews?: number;
};

/**
 * Compute implicit interest affinities from user's view history.
 * Uses exponential decay for older views.
 */
export async function computeUserAffinities(
  userId: string,
  opts: ComputeAffinitiesOptions = {}
): Promise<UserAffinities> {
  const lookbackDays = opts.lookbackDays ?? 60;
  const decayHalfLife = opts.decayHalfLifeDays ?? 14;
  const minViews = opts.minViews ?? 2;
  const now = new Date();
  const since = new Date(now.getTime() - lookbackDays * 24 * 60 * 60 * 1000);

  // Get user's view history with paper details
  const views = await db
    .select({
      paperId: schema.paperViews.paperId,
      viewedAt: schema.paperViews.viewedAt,
      categories: schema.papers.categories,
    })
    .from(schema.paperViews)
    .innerJoin(schema.papers, eq(schema.paperViews.paperId, schema.papers.id))
    .where(
      and(eq(schema.paperViews.userId, userId), gte(schema.paperViews.viewedAt, since))
    )
    .orderBy(desc(schema.paperViews.viewedAt));

  if (views.length === 0) {
    return { categories: {}, authors: {}, tasks: {} };
  }

  // Get authors and structured data for viewed papers
  const paperIds = [...new Set(views.map((v) => v.paperId))];

  const [authorRows, structuredRows] = await Promise.all([
    db
      .select({
        paperId: schema.paperAuthors.paperId,
        authorName: schema.authors.name,
      })
      .from(schema.paperAuthors)
      .innerJoin(schema.authors, eq(schema.paperAuthors.authorId, schema.authors.id))
      .where(inArray(schema.paperAuthors.paperId, paperIds)),
    db
      .select({
        paperId: schema.paperStructured.paperId,
        tasks: schema.paperStructured.tasks,
      })
      .from(schema.paperStructured)
      .where(inArray(schema.paperStructured.paperId, paperIds)),
  ]);

  // Build lookup maps
  const authorsByPaper = new Map<string, string[]>();
  for (const r of authorRows) {
    const arr = authorsByPaper.get(r.paperId) ?? [];
    arr.push(r.authorName);
    authorsByPaper.set(r.paperId, arr);
  }

  const tasksByPaper = new Map<string, string[]>();
  for (const r of structuredRows) {
    if (r.tasks?.length) {
      tasksByPaper.set(r.paperId, r.tasks);
    }
  }

  // Accumulate weighted counts with decay
  const catCounts: Record<string, number> = {};
  const authorCounts: Record<string, number> = {};
  const taskCounts: Record<string, number> = {};

  for (const view of views) {
    const ageMs = now.getTime() - new Date(view.viewedAt!).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    const decayWeight = Math.pow(2, -ageDays / decayHalfLife);

    // Categories
    for (const cat of view.categories ?? []) {
      catCounts[cat] = (catCounts[cat] ?? 0) + decayWeight;
    }

    // Authors
    const authors = authorsByPaper.get(view.paperId) ?? [];
    for (const auth of authors) {
      const norm = auth.toLowerCase().trim();
      authorCounts[norm] = (authorCounts[norm] ?? 0) + decayWeight;
    }

    // Tasks
    const tasks = tasksByPaper.get(view.paperId) ?? [];
    for (const task of tasks) {
      const norm = task.toLowerCase().trim();
      taskCounts[norm] = (taskCounts[norm] ?? 0) + decayWeight;
    }
  }

  // Normalize to 0-1 using max normalization
  const normalize = (counts: Record<string, number>, minCount: number) => {
    const filtered = Object.entries(counts).filter(([, v]) => v >= minCount);
    if (filtered.length === 0) return {};

    const maxCount = Math.max(...filtered.map(([, v]) => v));
    const result: Record<string, number> = {};
    for (const [key, val] of filtered) {
      result[key] = val / maxCount;
    }
    return result;
  };

  return {
    categories: normalize(catCounts, minViews * 0.5),
    authors: normalize(authorCounts, minViews * 0.3),
    tasks: normalize(taskCounts, minViews * 0.3),
  };
}

/**
 * Load user's view history for scoring.
 */
export async function getUserViewHistory(
  userId: string,
  opts: { lookbackDays?: number; limit?: number } = {}
): Promise<ViewHistoryEntry[]> {
  const lookbackDays = opts.lookbackDays ?? 30;
  const limit = opts.limit ?? 200;
  const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      paperId: schema.paperViews.paperId,
      viewedAt: schema.paperViews.viewedAt,
    })
    .from(schema.paperViews)
    .where(and(eq(schema.paperViews.userId, userId), gte(schema.paperViews.viewedAt, since)))
    .orderBy(desc(schema.paperViews.viewedAt))
    .limit(limit);

  return rows.map((r) => ({
    paperId: r.paperId,
    viewedAt: r.viewedAt!,
  }));
}

/**
 * Load cached affinities from user_interests table.
 */
export async function loadUserAffinities(userId: string): Promise<UserAffinities | null> {
  const rows = await db
    .select()
    .from(schema.userInterests)
    .where(eq(schema.userInterests.userId, userId));

  if (rows.length === 0) return null;

  const affinities: UserAffinities = {
    categories: {},
    authors: {},
    tasks: {},
  };

  for (const row of rows) {
    const score = Number(row.score) || 0;
    if (row.type === "category") {
      affinities.categories[row.value] = score;
    } else if (row.type === "author") {
      affinities.authors[row.value] = score;
    } else if (row.type === "task") {
      affinities.tasks[row.value] = score;
    }
  }

  return affinities;
}

/**
 * Save computed affinities to user_interests table.
 */
export async function saveUserAffinities(
  userId: string,
  affinities: UserAffinities
): Promise<void> {
  const now = new Date();
  const rows: Array<{
    userId: string;
    type: "category" | "author" | "task";
    value: string;
    normValue: string;
    score: string;
    source: string;
    updatedAt: Date;
  }> = [];

  for (const [cat, score] of Object.entries(affinities.categories)) {
    rows.push({
      userId,
      type: "category",
      value: cat,
      normValue: cat.toLowerCase(),
      score: String(score),
      source: "implicit",
      updatedAt: now,
    });
  }

  for (const [auth, score] of Object.entries(affinities.authors)) {
    rows.push({
      userId,
      type: "author",
      value: auth,
      normValue: auth.toLowerCase(),
      score: String(score),
      source: "implicit",
      updatedAt: now,
    });
  }

  for (const [task, score] of Object.entries(affinities.tasks)) {
    rows.push({
      userId,
      type: "task",
      value: task,
      normValue: task.toLowerCase(),
      score: String(score),
      source: "implicit",
      updatedAt: now,
    });
  }

  if (rows.length === 0) return;

  // Batch upsert
  for (const row of rows) {
    await db
      .insert(schema.userInterests)
      .values(row as any)
      .onConflictDoUpdate({
        target: [
          schema.userInterests.userId,
          schema.userInterests.type,
          schema.userInterests.value,
        ],
        set: {
          score: row.score,
          updatedAt: row.updatedAt,
        },
      });
  }
}
