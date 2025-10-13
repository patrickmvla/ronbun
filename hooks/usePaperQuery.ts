// hooks/usePaperQuery.ts
"use client";

import { useQuery, keepPreviousData, type QueryClient } from "@tanstack/react-query";

/**
  Paper detail shape used across the app (aligns with paper page + badges).
*/
export type PaperDetail = {
  arxivId: string;
  title: string;
  abstract: string;
  summary?: string;
  authors: string[];
  categories: string[];
  published: string; // ISO
  updated: string; // ISO
  pdfUrl: string | null;

  // Enrichment (optional)
  codeUrls?: string[];
  repoStars?: number | null;
  hasWeights?: boolean;

  // Structured (optional)
  method?: string | null;
  tasks?: string[];
  datasets?: string[];
  benchmarks?: string[];
  claimedSota?: number; // count
};

export type UsePaperOptions<T = PaperDetail> = {
  arxivId?: string | null;
  enabled?: boolean;
  staleTime?: number;
  select?: (paper: PaperDetail) => T;
};

/**
 * React Query key helper for a paper.
 */
export function paperQueryKey(arxivIdBase: string) {
  return ["paper", { id: arxivIdBase }] as const;
}

/**
 * Hook: fetch a paper by arXiv base ID (e.g., 2501.12345).
 * - Calls /api/papers/[arxivId]
 * - No mock fallbacks
 */
export function usePaperQuery<T = PaperDetail>({
  arxivId,
  enabled = true,
  staleTime = 60_000,
  select,
}: UsePaperOptions<T>) {
  const baseId = arxivId ? stripVersion(arxivId) : null;

  return useQuery<PaperDetail, Error, T>({
    queryKey: baseId ? paperQueryKey(baseId) : ["paper", { id: null }],
    enabled: Boolean(baseId) && enabled,
    staleTime,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      if (!baseId) throw new Error("Missing arXiv ID");
      const res = await fetch(`/api/papers/${encodeURIComponent(baseId)}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        next: { revalidate: 0 },
      });
      if (!res.ok) {
        const msg = await safeText(res);
        throw new Error(msg || `Request failed (${res.status})`);
      }
      const json = await res.json();
      return coercePaper(json);
    },
    select,
  });
}

/**
 * Prefetch helper (e.g., in useEffect or route loaders).
 */
export async function prefetchPaper(
  qc: QueryClient,
  arxivId: string,
  opts?: Omit<UsePaperOptions, "arxivId">
) {
  const baseId = stripVersion(arxivId);
  await qc.prefetchQuery({
    queryKey: paperQueryKey(baseId),
    queryFn: async () => {
      const res = await fetch(`/api/papers/${encodeURIComponent(baseId)}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        next: { revalidate: 0 },
      });
      if (!res.ok) {
        const msg = await safeText(res);
        throw new Error(msg || `Request failed (${res.status})`);
      }
      const json = await res.json();
      return coercePaper(json);
    },
    staleTime: opts?.staleTime ?? 60_000,
  });
}

/* ========== Coercion & utils ========== */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function coercePaper(x: any): PaperDetail {
  const baseId = stripVersion(String(x?.arxivId || x?.arxiv_id || x?.id || ""));
  const published = toIso(x?.published ?? x?.publishedAt);
  const updated = toIso(x?.updated ?? x?.updatedAt ?? x?.publishedAt);

  const title = String(x?.title ?? "");
  const abstract = String(x?.abstract ?? x?.summary ?? "");

  // URLs
  const pdfUrl =
    typeof x?.pdfUrl === "string"
      ? x.pdfUrl
      : baseId
      ? `https://arxiv.org/pdf/${baseId}.pdf`
      : null;

  const out: PaperDetail = {
    arxivId: baseId,
    title,
    abstract,
    summary: typeof x?.summary === "string" ? x.summary : undefined,
    authors: Array.isArray(x?.authors) ? x.authors.map(String) : [],
    categories: Array.isArray(x?.categories) ? x.categories.map(String) : [],
    published,
    updated,
    pdfUrl,
  };

  // Optional fields (only attach if present)
  if (Array.isArray(x?.codeUrls)) out.codeUrls = x.codeUrls.map(String);
  if (x?.repoStars !== undefined) out.repoStars = toNumOrNull(x.repoStars);
  if (x?.hasWeights !== undefined) out.hasWeights = Boolean(x.hasWeights);

  if (x?.method !== undefined) out.method = x.method;
  if (Array.isArray(x?.tasks)) out.tasks = x.tasks.map(String);
  if (Array.isArray(x?.datasets)) out.datasets = x.datasets.map(String);
  if (Array.isArray(x?.benchmarks)) out.benchmarks = x.benchmarks.map(String);
  if (x?.claimedSota !== undefined) out.claimedSota = toNumOrNull(x.claimedSota) ?? undefined;

  return out;
}

function stripVersion(arxivId: string) {
  return arxivId.replace(/v\d+$/i, "");
}

function toIso(v: unknown): string {
  try {
    const d = v ? new Date(String(v)) : new Date();
    return isFinite(d.getTime()) ? d.toISOString() : new Date().toISOString();
  } catch {
    return new Date().toISOString();
  }
}

function toNumOrNull(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}