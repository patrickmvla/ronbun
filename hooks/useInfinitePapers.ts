/* eslint-disable @typescript-eslint/no-explicit-any */
// hooks/useInfinitePapers.ts
"use client";

import { useInfiniteQuery } from "@tanstack/react-query";

/** Minimal paper shape for lists/feeds (now includes code fields). */
export type PaperListItem = {
  arxivId: string; // base id (e.g., 2501.12345)
  title: string;
  summary: string;
  authors: string[];
  categories: string[];
  published: string; // ISO
  updated: string; // ISO
  pdfUrl: string | null;
  // Enrichment
  codeUrls?: string[];
  hasWeights?: boolean;
  repoStars?: number | null;
};

export type UseInfinitePapersOptions = {
  // Build an arXiv API query: either pass q directly or derive from categories + search
  q?: string;
  categories?: string[]; // e.g., ["cs.AI","cs.LG"]
  search?: string; // free text; will be AND'ed with categories via all:<term>

  // Feed controls
  view?: "today" | "week" | "for-you"; // forwarded to DB feed
  codeOnly?: boolean; // DB: only papers with code

  // Pagination/sorting
  pageSize?: number; // page size
  sortBy?: "submittedDate" | "lastUpdatedDate";
  sortOrder?: "ascending" | "descending";

  // React Query
  enabled?: boolean;
  staleTime?: number;
};

/** Helper to build a safe arXiv-style query string from categories + search. */
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

/**
- If there's a free-text search term, we use arXiv proxy (/api/arxiv/search).
- If there are only categories (no text search), we use DB feed (/api/papers) with cursor pagination.
*/
export function useInfinitePapers({
  q,
  categories,
  search,
  view,
  codeOnly = false,
  pageSize = 25,
  sortBy = "submittedDate",
  sortOrder = "descending",
  enabled = true,
  staleTime = 30_000,
}: UseInfinitePapersOptions) {
  const query = (q ?? buildArxivQuery(categories, search)).trim();

  // Derive categories from query if not provided
  const catList = (categories && categories.length ? categories : extractCategoriesFromAqs(query)).filter(Boolean);

  const hasTextSearch =
    (search && search.trim().length > 0) ||
    (query && /\ball:/.test(query) && !/^\s*KATEX_INLINE_OPEN?\s*cat:/.test(query));

  const source = hasTextSearch ? "arxiv" : "db";

  return useInfiniteQuery<{ items: PaperListItem[]; nextCursor?: string | null }, Error>({
    queryKey: ["papers", { query, source, catList, view, codeOnly, pageSize, sortBy, sortOrder }],
    enabled: Boolean(query) && enabled,
    staleTime,
    initialPageParam: source === "arxiv" ? 0 : undefined,
    queryFn: async ({ pageParam }) => {
      if (source === "db") {
        // DB-backed feed with cursor pagination
        const params = new URLSearchParams();
        params.set("limit", String(pageSize));
        if (catList.length) params.set("categories", catList.join(","));
        if (view) params.set("view", view);
        if (codeOnly) params.set("code", "1");
        if (pageParam) params.set("cursor", String(pageParam));
        const res = await fetch(`/api/papers?${params.toString()}`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          next: { revalidate: 0 },
        });
        if (!res.ok) {
          const msg = await safeText(res);
          throw new Error(msg || `Request failed (${res.status})`);
        }
        const json = (await res.json()) as {
          items: any[];
          nextCursor: string | null;
        };

        // Map DB items (summary uses abstract in the feed API)
        const items: PaperListItem[] = (json.items ?? []).map((p: any) => ({
          arxivId: String(p.arxivId ?? p.arxivIdBase ?? ""),
          title: String(p.title ?? ""),
          summary: String(p.abstract ?? ""),
          authors: Array.isArray(p.authors) ? p.authors.map(String) : [],
          categories: Array.isArray(p.categories) ? p.categories.map(String) : [],
          published: toIso(p.published),
          updated: toIso(p.updated ?? p.published),
          pdfUrl:
            typeof p.pdfUrl === "string"
              ? p.pdfUrl
              : p.arxivId
              ? `https://arxiv.org/pdf/${p.arxivId}.pdf`
              : null,
          // Enrichment
          codeUrls: Array.isArray(p.codeUrls) ? p.codeUrls.map(String) : [],
          hasWeights: Boolean(p.hasWeights),
          repoStars: typeof p.repoStars === "number" ? p.repoStars : null,
        }));

        return { items, nextCursor: json.nextCursor ?? null };
      }

      // arXiv proxy with offset pagination
      const start = Number(pageParam) || 0;
      const url = `/api/arxiv/search?q=${encodeURIComponent(query)}&start=${start}&max=${pageSize}&sortBy=${sortBy}&sortOrder=${sortOrder}`;
      const res = await fetch(url, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        next: { revalidate: 0 },
      });
      if (!res.ok) {
        const msg = await safeText(res);
        throw new Error(msg || `Request failed (${res.status})`);
      }
      const json = (await res.json()) as { items: ArxivApiItem[] };
      return { items: (json.items ?? []).map(normalizeArxivItem) };
    },
    getNextPageParam: (lastPage, allPages) => {
      if (source === "db") {
        return lastPage.nextCursor ?? undefined;
      }
      // arXiv: offset-based
      const loaded = allPages.reduce((acc, p) => acc + p.items.length, 0);
      return (lastPage.items?.length ?? 0) < pageSize ? undefined : loaded;
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

function normalizeArxivItem(x: ArxivApiItem): PaperListItem {
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
    // No enrichment from arXiv source
    codeUrls: [],
    hasWeights: false,
    repoStars: null,
  };
}

function stripVersion(arxivId: string) {
  return String(arxivId || "").replace(/v\d+$/i, "");
}

function toIso(v: unknown): string {
  try {
    const d = v ? new Date(String(v)) : new Date();
    return Number.isFinite(d.getTime()) ? d.toISOString() : new Date().toISOString();
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

function extractCategoriesFromAqs(q: string): string[] {
  if (!q) return [];
  const out = new Set<string>();
  const re = /cat:([A-Za-z0-9.\-]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(q))) out.add(m[1]);
  return Array.from(out);
}