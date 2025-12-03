/* eslint-disable @typescript-eslint/no-explicit-any */
// lib/user-scores-cache.ts
// Cache and retrieve personalized user scores

import { db, schema } from "@/lib/drizzle/db";
import { eq, and, gte, inArray, sql } from "drizzle-orm";
import type { PersonalizedScoreComponents } from "./scoring";

const SCORE_TTL_HOURS = 12;

export type CachedUserScore = {
  paperId: string;
  personalizedScore: number;
  components: PersonalizedScoreComponents | null;
  watchlistVersion: number;
  computedAt: Date;
};

/**
 * Get user's current watchlist version.
 */
export async function getWatchlistVersion(userId: string): Promise<number> {
  const row = await db.query.watchlistVersions.findFirst({
    where: (v, { eq }) => eq(v.userId, userId),
  });
  return row?.version ?? 0;
}

/**
 * Increment user's watchlist version (call after watchlist changes).
 */
export async function incrementWatchlistVersion(userId: string): Promise<number> {
  const result = await db
    .insert(schema.watchlistVersions)
    .values({ userId, version: 1 })
    .onConflictDoUpdate({
      target: schema.watchlistVersions.userId,
      set: {
        version: sql`${schema.watchlistVersions.version} + 1`,
        updatedAt: new Date(),
      },
    })
    .returning({ version: schema.watchlistVersions.version });

  return result[0]?.version ?? 1;
}

/**
 * Get cached scores for papers that are still valid.
 * Returns a Map of paperId -> score.
 */
export async function getCachedUserScores(
  userId: string,
  paperIds: string[],
  currentVersion?: number
): Promise<Map<string, number>> {
  if (paperIds.length === 0) return new Map();

  const now = new Date();
  const minComputedAt = new Date(now.getTime() - SCORE_TTL_HOURS * 60 * 60 * 1000);

  // Get current version if not provided
  const version = currentVersion ?? (await getWatchlistVersion(userId));

  const rows = await db
    .select({
      paperId: schema.userScores.paperId,
      personalizedScore: schema.userScores.personalizedScore,
      watchlistVersion: schema.userScores.watchlistVersion,
      computedAt: schema.userScores.computedAt,
    })
    .from(schema.userScores)
    .where(
      and(
        eq(schema.userScores.userId, userId),
        inArray(schema.userScores.paperId, paperIds),
        eq(schema.userScores.watchlistVersion, version),
        gte(schema.userScores.computedAt, minComputedAt)
      )
    );

  const map = new Map<string, number>();
  for (const row of rows) {
    map.set(row.paperId, Number(row.personalizedScore));
  }
  return map;
}

/**
 * Cache personalized scores for a user.
 */
export async function cacheUserScores(
  userId: string,
  scores: Array<{
    paperId: string;
    score: number;
    components?: PersonalizedScoreComponents;
  }>,
  watchlistVersion?: number
): Promise<void> {
  if (scores.length === 0) return;

  const now = new Date();
  const version = watchlistVersion ?? (await getWatchlistVersion(userId));

  // Batch upsert (limit to first 100 to avoid huge writes)
  for (const { paperId, score, components } of scores.slice(0, 100)) {
    await db
      .insert(schema.userScores)
      .values({
        userId,
        paperId,
        personalizedScore: String(score),
        components: components as any,
        watchlistVersion: version,
        computedAt: now,
      })
      .onConflictDoUpdate({
        target: [schema.userScores.userId, schema.userScores.paperId],
        set: {
          personalizedScore: String(score),
          components: components as any,
          watchlistVersion: version,
          computedAt: now,
        },
      });
  }
}

/**
 * Invalidate all cached scores for a user.
 * Called when watchlist changes (version increment handles this implicitly).
 */
export async function invalidateUserScores(userId: string): Promise<void> {
  await db.delete(schema.userScores).where(eq(schema.userScores.userId, userId));
}

/**
 * Clean up expired cached scores (for periodic maintenance).
 */
export async function cleanupExpiredScores(): Promise<number> {
  const cutoff = new Date(Date.now() - SCORE_TTL_HOURS * 2 * 60 * 60 * 1000);

  const result = await db
    .delete(schema.userScores)
    .where(sql`${schema.userScores.computedAt} < ${cutoff}`)
    .returning({ paperId: schema.userScores.paperId });

  return result.length;
}
