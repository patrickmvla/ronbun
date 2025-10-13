"use client";

import { useEffect, useState, useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ViewTab, FeedFilters } from "@/types/feed";
import { parseCategoriesFromURL, parseViewFromURL } from "@/lib/utils/feed-filters";
import { FEED_CONFIG } from "@/config/feed";

export function useFeedFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Parse initial state from URL
  const initialView = parseViewFromURL(searchParams.get("view"));
  const initialCategories =
    parseCategoriesFromURL(searchParams.get("cats")) ||
    Array.from(FEED_CONFIG.defaultCategories);
  const initialQuery = searchParams.get("q")?.trim() || "";
  const initialWatchlist = searchParams.get("wl") || null; // This will be string | null

  // Local state
  const [view, setView] = useState<ViewTab>(initialView);
  const [categories, setCategories] = useState<string[]>(initialCategories);
  const [query] = useState(initialQuery);
  const [watchlist] = useState<string | null>(initialWatchlist); // ✅ Explicitly type as string | null

  // Update URL when filters change
  const updateURL = useCallback(
    (newView: ViewTab, newCategories: string[]) => {
      const params = new URLSearchParams(searchParams.toString());

      params.set("view", newView);
      params.set("cats", newCategories.join(","));

      // Preserve other params (q, wl)
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  // Sync URL when filters change
  useEffect(() => {
    updateURL(view, categories);
  }, [view, categories, updateURL]);

  // Toggle category
  const toggleCategory = useCallback((category: string) => {
    setCategories((prev) => {
      const exists = prev.includes(category);
      if (exists) {
        // Don't allow removing the last category
        if (prev.length === 1) return prev;
        return prev.filter((c) => c !== category);
      }
      return [...prev, category];
    });
  }, []);

  // Reset filters to defaults
  const resetFilters = useCallback(() => {
    setView(FEED_CONFIG.defaultView);
    setCategories(Array.from(FEED_CONFIG.defaultCategories));
  }, []);

  const filters: FeedFilters = {
    view,
    categories,
    query: query || undefined,
    watchlist,
  };

  return {
    filters,
    view,
    setView,
    categories,
    toggleCategory,
    resetFilters,
  };
}