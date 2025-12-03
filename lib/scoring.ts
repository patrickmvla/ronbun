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

// Extended components for personalized scoring
export type PersonalizedScoreComponents = ScoreComponents & {
  viewed: number;      // 0..1 (penalty for already-seen papers)
  implicit: number;    // 0..1 (category/author affinity from views)
  collaborative: number; // 0..1 (boost from similar users)
};

export type PersonalizedScoreResult = {
  global: number;        // 0..1 (base score without personalization)
  personalized: number;  // 0..1 (score with personalization)
  components: PersonalizedScoreComponents;
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
  now: new Date(), // note: computePaperScore overrides this at call-time
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
  // Merge options, but compute "now" fresh at call-time to avoid stale defaults.
  const cfg = {
    ...DEFAULT_SCORING,
    ...opts,
    now: opts?.now ?? new Date(),
    weights: { ...DEFAULT_SCORING.weights, ...(opts?.weights || {}) },
  };

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
  now: Date = new Date()
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
  const escaped = escapeRegex(needle);
  // token-ish match: (^|non-word)term(?=non-word|$)
  const re = new RegExp(`(^|\\W)${escaped}(?=\\W|$)`, "i");
  return re.test(hay);
}

function escapeRegex(str: string): string {
  // Escapes special regex characters
  return str.replace(/[-\/\\^$*+?.()|[```{}]/g, '\\$&');
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

/* ========== Personalization Scoring ========== */

/** User affinities derived from viewing patterns */
export type UserAffinities = {
  categories: Record<string, number>; // category -> normalized score 0-1
  authors: Record<string, number>;    // normalized author name -> score
  tasks: Record<string, number>;      // task -> score
};

/** View history entry */
export type ViewHistoryEntry = {
  paperId: string;
  viewedAt: Date;
};

/** Personalization context for scoring */
export type PersonalizationContext = {
  viewHistory?: ViewHistoryEntry[];
  affinities?: UserAffinities;
  similarUserPapers?: Map<string, number>; // paperId -> boost score
};

/** Weights for personalized scoring */
export const PERSONALIZED_WEIGHTS = {
  base: 0.6,           // weight of base score (recency, code, stars, watchlist)
  viewed: 0.15,        // weight for viewed penalty
  implicit: 0.15,      // weight for implicit interest boost
  collaborative: 0.1,  // weight for collaborative filtering boost
};

/**
 * Viewed component: penalize papers the user has already seen.
 * Returns 1 for unread papers, lower for recently viewed.
 */
export function viewedScore(
  paperId: string,
  viewHistory: ViewHistoryEntry[] | undefined,
  opts: { penalty?: number; decayDays?: number; now?: Date } = {}
): number {
  if (!viewHistory?.length) return 1; // unread = full score

  const penalty = opts.penalty ?? 0.7;
  const decayDays = opts.decayDays ?? 7;
  const now = opts.now ?? new Date();

  const view = viewHistory.find((v) => v.paperId === paperId);
  if (!view) return 1; // not viewed

  // Decay the penalty over time (old views matter less)
  const ageMs = now.getTime() - view.viewedAt.getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);

  // penalty decays exponentially: penalty * 2^(-ageDays/decayDays)
  const decayedPenalty = penalty * Math.pow(2, -ageDays / Math.max(1, decayDays));

  return clamp01(1 - decayedPenalty);
}

/**
 * Implicit interest component: based on user's viewing patterns.
 * Uses pre-computed affinity scores for categories, authors, tasks.
 */
export function implicitInterestScore(
  paper: PaperForScoring & { tasks?: string[] },
  affinities: UserAffinities | undefined
): number {
  if (!affinities) return 0;

  let score = 0;
  let weights = 0;

  // Category affinity (weight: 0.5)
  if (paper.categories?.length && Object.keys(affinities.categories).length) {
    const catScore =
      paper.categories.reduce((acc, cat) => acc + (affinities.categories[cat] ?? 0), 0) /
      paper.categories.length;
    score += 0.5 * catScore;
    weights += 0.5;
  }

  // Author affinity (weight: 0.3)
  if (paper.authors?.length && Object.keys(affinities.authors).length) {
    const authScore =
      paper.authors.reduce((acc, auth) => {
        const normalized = normalizeName(auth);
        return acc + (affinities.authors[normalized] ?? 0);
      }, 0) / paper.authors.length;
    score += 0.3 * authScore;
    weights += 0.3;
  }

  // Task affinity (weight: 0.2) - from structured extraction
  if (paper.tasks?.length && Object.keys(affinities.tasks).length) {
    const taskScore =
      paper.tasks.reduce((acc, task) => {
        const normalized = task.toLowerCase();
        return acc + (affinities.tasks[normalized] ?? 0);
      }, 0) / paper.tasks.length;
    score += 0.2 * taskScore;
    weights += 0.2;
  }

  return weights > 0 ? clamp01(score / weights) : 0;
}

/**
 * Similar users component: collaborative filtering boost.
 * Boost papers that similar users have engaged with.
 */
export function similarUsersScore(
  paperId: string,
  similarUserPapers: Map<string, number> | undefined
): number {
  if (!similarUserPapers) return 0;
  return clamp01(similarUserPapers.get(paperId) ?? 0);
}

/**
 * Compute personalized score combining base score with user context.
 */
export function computePersonalizedScore(
  paper: PaperForScoring & { paperId?: string; tasks?: string[] },
  watchlists: WatchlistInput[] = [],
  personalization: PersonalizationContext = {},
  opts?: ScoreOptions
): PersonalizedScoreResult {
  // Get base score
  const base = computePaperScore(paper, watchlists, opts);
  const paperId = paper.paperId ?? paper.arxivId ?? "";

  // Personalization components
  const v = viewedScore(paperId, personalization.viewHistory, { now: opts?.now });
  const i = implicitInterestScore(paper, personalization.affinities);
  const c = similarUsersScore(paperId, personalization.similarUserPapers);

  // Compute personalized score
  // viewed acts as a multiplier (penalty), while implicit and collaborative add boost
  const personalized = clamp01(
    PERSONALIZED_WEIGHTS.base * base.global * v + // base score with view penalty
    PERSONALIZED_WEIGHTS.implicit * i +            // implicit interest boost
    PERSONALIZED_WEIGHTS.collaborative * c         // collaborative boost
  );

  return {
    global: base.global,
    personalized,
    components: {
      ...base.components,
      viewed: v,
      implicit: i,
      collaborative: c,
    },
  };
}