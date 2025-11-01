// app/(app)/feed/page.tsx
"use client";

import { useMemo, Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import { FeedHeader } from "@/components/feed/feed-header";
import { FeedControls } from "@/components/feed/feed-controls";
import { SearchNotice } from "@/components/feed/search-notice";
import { FeedContent } from "@/components/feed/feed-content";
import { useFeedFilters } from "@/hooks/use-feed-filters";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { useInfinitePapers, buildArxivQuery } from "@/hooks/useInfinitePapers";
import { applyViewFilter } from "@/lib/utils/feed-filters";
import { FEED_CONFIG } from "@/config/feed";

export const dynamic = "force-dynamic";

function FeedPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Manage filters and URL state
  const {
    filters,
    view,
    setView,
    categories,
    toggleCategory,
    resetFilters,
  } = useFeedFilters();

  // Advanced filters state (from URL)
  const [codeOnly, setCodeOnly] = useState(searchParams.get("code") === "1");
  const [hasWeights, setHasWeights] = useState(searchParams.get("weights") === "1");
  const [withBenchmarks, setWithBenchmarks] = useState(searchParams.get("benchmarks") === "1");

  // Sync advanced filters to URL
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());

    // Update advanced filter params
    if (codeOnly) {
      params.set("code", "1");
    } else {
      params.delete("code");
    }

    if (hasWeights) {
      params.set("weights", "1");
    } else {
      params.delete("weights");
    }

    if (withBenchmarks) {
      params.set("benchmarks", "1");
    } else {
      params.delete("benchmarks");
    }

    router.replace(`/feed?${params.toString()}`, { scroll: false });
  }, [codeOnly, hasWeights, withBenchmarks, router, searchParams]);

  // Build arXiv query
  const arxivQuery = useMemo(
    () => buildArxivQuery(categories, filters.query),
    [categories, filters.query]
  );

  // Fetch papers with infinite scroll
  const {
    data,
    isPending,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error,
  } = useInfinitePapers({
    q: arxivQuery,
    view, // ✅ Pass view to server for DB-level filtering
    codeOnly,
    hasWeights,
    withBenchmarks,
    pageSize: FEED_CONFIG.pageSize,
    sortBy: FEED_CONFIG.sortBy,
    sortOrder: FEED_CONFIG.sortOrder,
    enabled: arxivQuery.length > 0 || categories.length > 0,
  });

  // Flatten pages and apply client-side filter as fallback
  // (DB source pre-filters, but arXiv source needs client-side filtering)
  const papers = useMemo(() => {
    const allPapers = data?.pages.flatMap((page) => page.items) ?? [];
    // Only filter if we have a search query (arXiv source)
    const hasTextSearch = Boolean(filters.query?.trim());
    return hasTextSearch ? applyViewFilter(allPapers, view) : allPapers;
  }, [data, view, filters.query]);

  // Setup infinite scroll
  const { sentinelRef } = useInfiniteScroll({
    onLoadMore: fetchNextPage,
    hasMore: hasNextPage ?? false,
    isLoading: isFetchingNextPage,
    rootMargin: FEED_CONFIG.infiniteScrollMargin,
  });

  return (
    <div className="mx-auto w-full max-w-7xl">
      {/* Header with filters */}
      <div className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-end sm:justify-between">
        <FeedHeader
          watchlist={filters.watchlist}
          categoryCount={categories.length}
        />
        <FeedControls
          view={view}
          onViewChange={setView}
          selectedCategories={categories}
          onCategoryToggle={toggleCategory}
          codeOnly={codeOnly}
          hasWeights={hasWeights}
          withBenchmarks={withBenchmarks}
          onCodeOnlyChange={setCodeOnly}
          onHasWeightsChange={setHasWeights}
          onWithBenchmarksChange={setWithBenchmarks}
        />
      </div>

      <Separator className="mb-4 opacity-50" />

      {/* Search context notice */}
      <SearchNotice query={filters.query || ""} categoryCount={categories.length} />

      {/* Papers list */}
      <FeedContent
        papers={papers}
        isLoading={isPending}
        isLoadingMore={isFetchingNextPage}
        hasMore={hasNextPage ?? false}
        error={error}
        onLoadMore={fetchNextPage}
        onRetry={() => router.refresh()}
        onReset={resetFilters}
        sentinelRef={sentinelRef}
      />
    </div>
  );
}

export default function FeedPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-7xl">
          <div className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Feed</h1>
              <p className="mt-1 text-sm text-muted-foreground">Loading your papers…</p>
            </div>
            <div className="h-9 w-48 rounded-md border bg-muted/30" />
          </div>
          <Separator className="mb-4 opacity-50" />
          <div className="space-y-3">
            <div className="h-20 rounded-lg border bg-card" />
            <div className="h-20 rounded-lg border bg-card" />
            <div className="h-20 rounded-lg border bg-card" />
          </div>
        </div>
      }
    >
      <FeedPageInner />
    </Suspense>
  );
}