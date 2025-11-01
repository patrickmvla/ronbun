// lib/utils/watchlist-helpers.ts
// Helper functions for converting watchlists to scoring inputs

import type { WatchlistItem } from "@/types/watchlists";
import type { WatchlistInput } from "@/lib/scoring";

/**
 * Convert DB watchlist items to scoring format
 */
export function watchlistsToScoringInput(watchlists: WatchlistItem[]): WatchlistInput[] {
  return watchlists.map((wl) => ({
    terms: wl.terms ?? [],
    type: wl.type,
    categories: wl.categories && wl.categories.length > 0 ? wl.categories : undefined,
  }));
}

/**
 * Check if a paper matches any watchlist
 */
export function paperMatchesWatchlists(
  paper: {
    title: string;
    abstract?: string;
    authors?: string[];
    categories?: string[];
    benchmarks?: string[];
  },
  watchlists: WatchlistItem[]
): string[] {
  const matched: string[] = [];

  for (const wl of watchlists) {
    if (watchlistMatches(paper, wl)) {
      matched.push(wl.id);
    }
  }

  return matched;
}

function watchlistMatches(
  paper: {
    title: string;
    abstract?: string;
    authors?: string[];
    categories?: string[];
    benchmarks?: string[];
  },
  wl: WatchlistItem
): boolean {
  // Category restriction (if specified)
  if (wl.categories && wl.categories.length > 0 && paper.categories && paper.categories.length > 0) {
    const hasMatchingCat = paper.categories.some((c) => wl.categories!.includes(c));
    if (!hasMatchingCat) return false;
  }

  const terms = (wl.terms ?? []).map((t) => t.toLowerCase());
  if (terms.length === 0) return false;

  const title = paper.title.toLowerCase();
  const abstract = (paper.abstract || "").toLowerCase();
  const text = `${title} ${abstract}`;
  const authors = (paper.authors || []).map((a) => a.toLowerCase());
  const benchmarks = (paper.benchmarks || []).map((b) => b.toLowerCase());

  for (const term of terms) {
    if (wl.type === "keyword" || wl.type === "institution") {
      if (includesToken(text, term)) return true;
    } else if (wl.type === "author") {
      if (authors.some((a) => a.includes(term) || term.includes(a))) return true;
    } else if (wl.type === "benchmark") {
      if (benchmarks.includes(term) || includesToken(text, term)) return true;
    }
  }

  return false;
}

function includesToken(hay: string, needle: string): boolean {
  if (!hay || !needle) return false;
  const escaped = escapeRegex(needle);
  const re = new RegExp(`(^|\\W)${escaped}(?=\\W|$)`, "i");
  return re.test(hay);
}

function escapeRegex(str: string): string {
  return str.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
}
