// lib/scoring.ts
// Transparent, simple scoring for ranking papers in feeds.
// Components (each 0..1): recency, code, stars, watchlist
// Global = weighted sum of components (weights sum to 1)

export type ScoreComponents = {
  recency: number;   // 0..1 (time decay)
  code: number;      // 0..1 (code + weights presence)
  stars: number;     // 0..1 (scaled by repo stars)
  watchlist: number; // 0..1 (matches user watchlists)
};

export type ScoreResult = {
  global: number; // 0..1
  components: ScoreComponents;
};

export type WatchlistInput = {
  terms: string[];
  type?: "keyword" | "author" | "benchmark" | "institution";
  categories?: string[]; // optional category restriction
};

export type PaperForScoring = {
  arxivId?: string;
  title: string;
  abstract?: string;
  authors?: string[];
  categories?: string[];
  publishedAt?: string | Date | null;
  codeUrls?: string[] | null;
  hasWeights?: boolean | null;
  repoStars?: number | null;
  benchmarks?: string[]; // optional structured extraction
};

export type ScoreOptions = {
  now?: Date;
  halfLifeDays?: number; // recency half-life
  starsCap?: number;     // cap for star scaling
  weights?: {
    recency: number;
    code: number;
    stars: number;
    watchlist: number;
  };
  codeBase?: number;        // base score if any code is present
  hasWeightsBonus?: number; // extra if weights are present
  keywordWeight?: number;   // watchlist keyword weight
  authorWeight?: number;    // watchlist author weight
  benchmarkWeight?: number; // watchlist benchmark weight
  maxWatchBoost?: number;   // cap for watchlist raw sum before normalization
};

export const DEFAULT_SCORING: Required<ScoreOptions> = {
  now: new Date(),
  halfLifeDays: 5,
  starsCap: 1500,
  weights: {
    recency: 0.5,
    code: 0.15,
    stars: 0.15,
    watchlist: 0.2,
  },
  codeBase: 0.7,
  hasWeightsBonus: 0.3,
  keywordWeight: 1.0,
  authorWeight: 1.2,
  benchmarkWeight: 1.1,
  maxWatchBoost: 5, // raw points before squashing
};

/**
 * Main entry: compute momentum score (0..1) + components.
 */
export function computePaperScore(
  paper: PaperForScoring,
  watchlists: WatchlistInput[] = [],
  opts?: ScoreOptions
): ScoreResult {
  const cfg = { ...DEFAULT_SCORING, ...opts, weights: { ...DEFAULT_SCORING.weights, ...(opts?.weights || {}) } };

  const r = recencyScore(paper.publishedAt, cfg.halfLifeDays, cfg.now);
  const c = codeScore(paper.codeUrls, paper.hasWeights, cfg.codeBase, cfg.hasWeightsBonus);
  const s = starsScore(paper.repoStars, cfg.starsCap);
  const w = watchlistScore(paper, watchlists, {
    keywordWeight: cfg.keywordWeight,
    authorWeight: cfg.authorWeight,
    benchmarkWeight: cfg.benchmarkWeight,
    maxWatchBoost: cfg.maxWatchBoost,
  });

  const global =
    cfg.weights.recency * r +
    cfg.weights.code * c +
    cfg.weights.stars * s +
    cfg.weights.watchlist * w;

  return {
    global: clamp01(global),
    components: { recency: r, code: c, stars: s, watchlist: w },
  };
}

/**
 * Recency via exponential decay with half-life (days).
 * ageDays = (now - published) in days → score = 2^(-age/halfLife)
 */
export function recencyScore(
  publishedAt: string | Date | null | undefined,
  halfLifeDays = DEFAULT_SCORING.halfLifeDays,
  now: Date = DEFAULT_SCORING.now
): number {
  const t = toDate(publishedAt);
  if (!t) return 0;
  const ageMs = Math.max(0, now.getTime() - t.getTime());
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  if (ageDays <= 0) return 1;
  const score = Math.pow(2, -ageDays / Math.max(1e-6, halfLifeDays));
  return clamp01(score);
}

/**
 * Code component: base if code present, plus bonus if weights available (capped to 1).
 */
export function codeScore(
  codeUrls?: string[] | null,
  hasWeights?: boolean | null,
  base = DEFAULT_SCORING.codeBase,
  weightsBonus = DEFAULT_SCORING.hasWeightsBonus
): number {
  const hasCode = Array.isArray(codeUrls) && codeUrls.length > 0;
  if (!hasCode) return 0;
  let score = base;
  if (hasWeights) score += weightsBonus;
  return Math.min(1, score);
}

/**
 * Stars component: compress via sqrt scaling against cap → 0..1
 */
export function starsScore(stars?: number | null, cap = DEFAULT_SCORING.starsCap): number {
  const n = Number(stars);
  if (!Number.isFinite(n) || n <= 0) return 0;
  const capped = Math.min(n, cap);
  const score = Math.sqrt(capped / Math.max(1, cap));
  return clamp01(score);
}

/**
 * Watchlist component: accumulate matches across lists with weights, squash to 0..1 via 1 - exp(-x/k)
 */
export function watchlistScore(
  paper: PaperForScoring,
  watchlists: WatchlistInput[],
  cfg: {
    keywordWeight: number;
    authorWeight: number;
    benchmarkWeight: number;
    maxWatchBoost: number;
  } = {
    keywordWeight: DEFAULT_SCORING.keywordWeight,
    authorWeight: DEFAULT_SCORING.authorWeight,
    benchmarkWeight: DEFAULT_SCORING.benchmarkWeight,
    maxWatchBoost: DEFAULT_SCORING.maxWatchBoost,
  }
): number {
  if (!watchlists?.length) return 0;

  const title = (paper.title || "").toLowerCase();
  const abstract = (paper.abstract || "").toLowerCase();
  const text = `${title} ${abstract}`;
  const authors = (paper.authors || []).map(normalizeName);
  const benchmarks = (paper.benchmarks || []).map((b) => b.toLowerCase());

  let points = 0;

  for (const wl of watchlists) {
    const terms = (wl.terms || []).map((t) => t.trim()).filter(Boolean);
    if (!terms.length) continue;

    // Optional category restriction
    if (wl.categories && wl.categories.length && paper.categories && paper.categories.length) {
      const ok = paper.categories.some((c) => wl.categories!.includes(c));
      if (!ok) continue;
    }

    for (const termRaw of terms) {
      const term = termRaw.toLowerCase();

      if (!wl.type || wl.type === "keyword" || wl.type === "institution") {
        if (includesToken(text, term)) points += cfg.keywordWeight;
      } else if (wl.type === "author") {
        if (authors.includes(normalizeName(termRaw))) points += cfg.authorWeight;
      } else if (wl.type === "benchmark") {
        if (benchmarks.includes(term) || includesToken(text, term)) points += cfg.benchmarkWeight;
      }
    }
  }

  if (points <= 0) return 0;

  // Squash: score = 1 - exp(-points / k), where k ~= maxWatchBoost
  const score = 1 - Math.exp(-points / Math.max(1e-6, cfg.maxWatchBoost));
  return clamp01(score);
}

/* ========== Utilities ========== */

function includesToken(hay: string, needle: string): boolean {
  if (!hay || !needle) return false;
  // Escape regex special chars in needle
  const escaped = needle.replace(/[.*+?^${}()|[```\```/g, "\\$&");
  const re = new RegExp(`(^|\\W)${escaped}(?=\\W|$)`, "i");
  return re.test(hay);
}

function normalizeName(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function toDate(v: string | Date | null | undefined): Date | null {
  if (!v) return null;
  if (v instanceof Date) return Number.isFinite(v.getTime()) ? v : null;
  const d = new Date(String(v));
  return Number.isFinite(d.getTime()) ? d : null;
}

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

/* ========== Convenience helpers ========== */

/** Sort papers by descending global score (use with Array.sort). */
export function compareByScoreDesc(a: ScoreResult, b: ScoreResult) {
  return b.global - a.global;
}

/** Quick partial recompute if only stars updated. */
export function recomputeWithStars(prev: ScoreResult, stars: number, opts?: ScoreOptions): ScoreResult {
  const s = starsScore(stars, opts?.starsCap ?? DEFAULT_SCORING.starsCap);
  const weights = { ...DEFAULT_SCORING.weights, ...(opts?.weights || {}) };
  const global =
    weights.recency * prev.components.recency +
    weights.code * prev.components.code +
    weights.stars * s +
    weights.watchlist * prev.components.watchlist;

  return {
    global: clamp01(global),
    components: { ...prev.components, stars: s },
  };
}