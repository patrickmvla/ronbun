// lib/zod.ts
// Shared Zod schemas and types for API contracts and LLM outputs.

import { z } from "zod";

/* ========== arXiv ========== */

export const ArxivItem = z.object({
  arxivId: z.string(),
  title: z.string(),
  summary: z.string(),
  authors: z.array(z.string()),
  categories: z.array(z.string()),
  published: z.string(), // ISO
  updated: z.string(),   // ISO
  pdfUrl: z.string().nullable(),
});
export type TArxivItem = z.infer<typeof ArxivItem>;

/* ========== Explainers ========== */

export const ExplainLevels = z.enum(["eli5", "student", "expert"]);
export type TExplainLevel = z.infer<typeof ExplainLevels>;

export const ExplainInput = z.object({
  title: z.string().min(1),
  abstract: z.string().min(1),
  level: ExplainLevels,
  readme: z.string().optional(),
});
export type TExplainInput = z.infer<typeof ExplainInput>;

/* ========== Summaries ========== */

export const SummarizeInput = z.object({
  title: z.string().min(1),
  abstract: z.string().min(1),
});
export type TSummarizeInput = z.infer<typeof SummarizeInput>;

/* ========== Extraction (LLM) ========== */

export const ClaimedSotaItem = z.object({
  benchmark: z.string(),
  metric: z.string().optional(),
  value: z.string().optional(),
  split: z.string().optional(),
});

export const ExtractedLLM = z.object({
  method: z.string().nullable(),
  tasks: z.array(z.string()).default([]),
  datasets: z.array(z.string()).default([]),
  benchmarks: z.array(z.string()).default([]),
  claimed_sota: z.array(ClaimedSotaItem).default([]),
  params: z.number().nullable().optional(),  // total params (B) if available
  tokens: z.number().nullable().optional(),  // training tokens (B) if available
  compute: z.string().nullable().optional(), // free-text compute budget
  code_urls: z.array(z.string()).default([]),
});
export type TExtractedLLM = z.infer<typeof ExtractedLLM>;

export const ExtractInput = z.object({
  title: z.string().min(1),
  abstract: z.string().min(1),
});
export type TExtractInput = z.infer<typeof ExtractInput>;

/* ========== Reviewer (LLM) ========== */

export const ReviewLLM = z.object({
  strengths: z.array(z.string()).default([]),
  weaknesses: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
  next_experiments: z.array(z.string()).default([]),
  reproducibility_notes: z.string().nullable().default(null),
  novelty_score: z.number().int().min(0).max(3).nullable().default(null),
  clarity_score: z.number().int().min(0).max(3).nullable().default(null),
  caveats: z.string().nullable().optional(),
});
export type TReviewLLM = z.infer<typeof ReviewLLM>;

export const ReviewInput = z.object({
  title: z.string().min(1),
  abstract: z.string().min(1),
  readme: z.string().optional(),
});
export type TReviewInput = z.infer<typeof ReviewInput>;

/* ========== Watchlists (shared) ========== */

export const WatchlistType = z.enum(["keyword", "author", "benchmark", "institution"]);
export type TWatchlistType = z.infer<typeof WatchlistType>;

export const WatchlistSchema = z.object({
  id: z.string().optional(),
  type: WatchlistType,
  name: z.string().min(2).max(64),
  terms: z.array(z.string().min(2).max(64)).min(1).max(20),
  categories: z.array(z.string()).default([]),
});
export type TWatchlist = z.infer<typeof WatchlistSchema>;

/* ========== Papers with Code (lookup) ========== */

export const PwcSotaLink = z.object({
  label: z.string(),
  url: z.string().url(),
});
export type TPwcSotaLink = z.infer<typeof PwcSotaLink>;

export const PwcLookup = z.object({
  found: z.boolean(),
  paperUrl: z.string().url().nullable().optional(),
  repoUrl: z.string().url().nullable().optional(),
  repoStars: z.number().nullable().optional(),
  searchUrl: z.string(), // arbitrary (may be web search URL)
  sotaLinks: z.array(PwcSotaLink).default([]),
});
export type TPwcLookup = z.infer<typeof PwcLookup>;

/* ========== Optional: Paper detail (API response) ========== */
/* This is a best-effort schema; fields are optional where integrations may not populate them. */
export const PaperDetail = z.object({
  arxivId: z.string(),
  title: z.string(),
  abstract: z.string(),
  summary: z.string().optional(),
  authors: z.array(z.string()).default([]),
  categories: z.array(z.string()).default([]),
  published: z.string(),
  updated: z.string(),
  pdfUrl: z.string().nullable(),

  // enrichment
  codeUrls: z.array(z.string()).optional(),
  repoStars: z.number().nullable().optional(),
  hasWeights: z.boolean().optional(),

  // structured
  method: z.string().nullable().optional(),
  tasks: z.array(z.string()).optional(),
  datasets: z.array(z.string()).optional(),
  benchmarks: z.array(z.string()).optional(),
  claimedSota: z.number().optional(),
});
export type TPaperDetail = z.infer<typeof PaperDetail>;