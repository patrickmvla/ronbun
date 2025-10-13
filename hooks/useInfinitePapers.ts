// hooks/useInfinitePapers.ts
"use client";

import { useInfiniteQuery } from "@tanstack/react-query";

/** Minimal paper shape for lists/feeds. */
export type PaperListItem = {
  arxivId: string; // base id (e.g., 2501.12345)
  title: string;
  summary: string;
  authors: string[];
  categories: string[];
  published: string; // ISO
  updated: string; // ISO
  pdfUrl: string | null;
};

export type UseInfinitePapersOptions = {
  // Build an arXiv API query: either pass q directly or derive from categories + search
  q?: string;
  categories?: string[]; // e.g., ["cs.AI","cs.LG"]
  search?: string; // free text; will be AND'ed with categories via all:<term>

  // Pagination/sorting
  pageSize?: number; // arXiv max results per page (default 25)
  sortBy?: "submittedDate" | "lastUpdatedDate";
  sortOrder?: "ascending" | "descending";

  // React Query
  enabled?: boolean;
  staleTime?: number;
};

/** Helper to build a safe arXiv query string from categories + search. */
export function buildArxivQuery(categories?: string[], search?: string) {
  const cats = (categories ?? []).filter(Boolean);
  const catClause = cats.length ? cats.map((c) => `cat:${c}`).join(" OR ") : "";
  const term = (search ?? "").trim();

  if (!catClause && !term) return ""; // empty query (caller should handle)
  if (!catClause && term) return `all:${escapeQuery(term)}`;
  if (catClause && !term) return catClause;

  // Both present
  return `(${catClause}) AND all:${escapeQuery(term)}`;
}

/** Hook: infinite arXiv search via our /api/arxiv/search proxy. No mocks. */
export function useInfinitePapers({
  q,
  categories,
  search,
  pageSize = 25,
  sortBy = "submittedDate",
  sortOrder = "descending",
  enabled = true,
  staleTime = 30_000,
}: UseInfinitePapersOptions) {
  const query = (q ?? buildArxivQuery(categories, search)).trim();

  return useInfiniteQuery<
    { items: PaperListItem[] },
    Error
  >({
    queryKey: ["papers", { query, pageSize, sortBy, sortOrder }],
    enabled: Boolean(query) && enabled,
    staleTime,
    initialPageParam: 0 as number, // arXiv offset
    queryFn: async ({ pageParam }) => {
      const start = Number(pageParam) || 0;
      const url = `/api/arxiv/search?q=${encodeURIComponent(query)}&start=${start}&max=${pageSize}&sortBy=${sortBy}&sortOrder=${sortOrder}`;
      const res = await fetch(url, { method: "GET", headers: { "Content-Type": "application/json" }, next: { revalidate: 0 } });
      if (!res.ok) {
        const msg = await safeText(res);
        throw new Error(msg || `Request failed (${res.status})`);
      }
      const json = (await res.json()) as { items: ArxivApiItem[] };
      return { items: (json.items ?? []).map(normalizeItem) };
    },
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((acc, p) => acc + p.items.length, 0);
      // If fewer items than a page were returned, stop. Otherwise request next offset.
      return lastPage.items.length < pageSize ? undefined : loaded;
    },
  });
}

/* ========== Types from /api/arxiv/search ========== */
type ArxivApiItem = {
  arxivId: string; // may include version
  title: string;
  summary: string;
  authors: string[];
  categories: string[];
  published: string; // ISO
  updated: string; // ISO
  pdfUrl: string | null;
};

/* ========== Normalization & utils ========== */

function normalizeItem(x: ArxivApiItem): PaperListItem {
  const baseId = stripVersion(x.arxivId);
  return {
    arxivId: baseId,
    title: String(x.title ?? ""),
    summary: String(x.summary ?? ""),
    authors: Array.isArray(x.authors) ? x.authors.map(String) : [],
    categories: Array.isArray(x.categories) ? x.categories.map(String) : [],
    published: toIso(x.published),
    updated: toIso(x.updated || x.published),
    pdfUrl: typeof x.pdfUrl === "string" ? x.pdfUrl : `https://arxiv.org/pdf/${baseId}.pdf`,
  };
}

function stripVersion(arxivId: string) {
  return String(arxivId || "").replace(/v\d+$/i, "");
}

function toIso(v: unknown): string {
  try {
    const d = v ? new Date(String(v)) : new Date();
    return isFinite(d.getTime()) ? d.toISOString() : new Date().toISOString();
  } catch {
    return new Date().toISOString();
  }
}

function escapeQuery(q: string) {
  return q.replace(/\s+/g, "+");
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}