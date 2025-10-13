"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
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

export default function FeedPage() {
  const router = useRouter();

  // Manage filters and URL state
  const {
    filters,
    view,
    setView,
    categories,
    toggleCategory,
    resetFilters,
  } = useFeedFilters();

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
    pageSize: FEED_CONFIG.pageSize,
    sortBy: FEED_CONFIG.sortBy,
    sortOrder: FEED_CONFIG.sortOrder,
    enabled: arxivQuery.length > 0 || categories.length > 0,
  });

  // Flatten pages and apply time filter
  const papers = useMemo(() => {
    const allPapers = data?.pages.flatMap((page) => page.items) ?? [];
    return applyViewFilter(allPapers, view);
  }, [data, view]);

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