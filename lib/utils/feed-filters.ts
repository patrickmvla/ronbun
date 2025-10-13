import type { ViewTab } from "@/types/feed";
import type { PaperListItem } from "@/hooks/useInfinitePapers";
import { DEFAULT_CATEGORIES } from "@/config/feed";

/**
 * Parse and validate categories from URL parameter
 */
export function parseCategoriesFromURL(
  catsParam: string | null
): string[] | null {
  if (!catsParam) return null;

  const parts = catsParam
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const valid = parts.filter((cat) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    DEFAULT_CATEGORIES.includes(cat as any)
  );

  return valid.length > 0 ? valid : null;
}

/**
 * Apply time-based filter to papers based on view
 */
export function applyViewFilter(
  items: PaperListItem[],
  view: ViewTab,
  referenceDate: Date = new Date()
): PaperListItem[] {
  // "For You" shows all items (personalized ranking handled elsewhere)
  if (view === "for-you") {
    return items;
  }

  const now = referenceDate.getTime();

  const timeRanges: Record<Exclude<ViewTab, "for-you">, number> = {
    today: 24 * 60 * 60 * 1000, // 24 hours
    week: 7 * 24 * 60 * 60 * 1000, // 7 days
  };

  const cutoffTime = now - timeRanges[view];

  return items.filter((paper) => {
    const publishedTime = new Date(paper.published).getTime();
    return publishedTime >= cutoffTime;
  });
}

/**
 * Get description for current filters
 */
export function getFilterDescription(
  watchlist: string | null,
  categoryCount: number
): string {
  if (watchlist) {
    return `Watchlist: ${watchlist}`;
  }

  return `Latest papers from ${categoryCount} ${
    categoryCount === 1 ? "category" : "categories"
  }`;
}

/**
 * Validate view parameter from URL
 */
export function parseViewFromURL(viewParam: string | null): ViewTab {
  const validViews: ViewTab[] = ["today", "week", "for-you"];

  if (viewParam && validViews.includes(viewParam as ViewTab)) {
    return viewParam as ViewTab;
  }

  return "today";
}
