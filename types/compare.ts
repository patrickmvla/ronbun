/* eslint-disable @typescript-eslint/no-explicit-any */
// lib/types/compare.ts
export type CompareItem = {
  arxivId: string;
  found: boolean;

  // Basic
  title?: string;
  authors?: string[];
  categories?: string[];
  published?: string;
  updated?: string;
  pdfUrl?: string | null;

  // Enrichment
  codeUrls?: string[];
  repoStars?: number | null;
  hasWeights?: boolean;

  // Structured
  method?: string | null;
  tasks?: string[];
  datasets?: string[];
  benchmarks?: string[];
  claimedSota?: number; // count

  // Score + links
  score?: { global: number; components?: any };
  links?: { abs: string | null; pwc: string | null; repo: string | null };
};

export type CompareResponse = { items: CompareItem[] };