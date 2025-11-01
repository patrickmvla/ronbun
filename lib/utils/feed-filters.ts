import type { ViewTab } from "@/types/feed";
import type { PaperListItem } from "@/hooks/useInfinitePapers";
import { DEFAULT_CATEGORIES } from "@/config/feed";

/** Allowed category type derived from config */
type AllowedCategory = (typeof DEFAULT_CATEGORIES)[number];

/** Type guard for categories */
function isAllowedCategory(cat: string): cat is AllowedCategory {
  return (DEFAULT_CATEGORIES as readonly string[]).includes(cat);
}

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

  const valid = parts.filter(isAllowedCategory);
  return valid.length > 0 ? valid : null;
}

/**
 * Apply time-based filter to papers based on view
 * - today: from local start-of-day to now
 * - week: last 7 days rolling window
 * - for-you: no time filter (ranking handled elsewhere)
 */
export function applyViewFilter(
  items: PaperListItem[],
  view: ViewTab,
  referenceDate: Date = new Date()
): PaperListItem[] {
  if (view === "for-you") return items;

  const nowMs = referenceDate.getTime();
  let cutoffMs: number;

  if (view === "today") {
    const startOfDay = new Date(referenceDate);
    startOfDay.setHours(0, 0, 0, 0);
    cutoffMs = startOfDay.getTime();
  } else {
    // week
    cutoffMs = nowMs - 7 * 24 * 60 * 60 * 1000;
  }

  return items.filter((paper) => {
    const publishedMs = Date.parse(paper.published);
    return Number.isFinite(publishedMs) && publishedMs >= cutoffMs;
  });
}

/**
 * Get description for current filters
 */
export function getFilterDescription(
  watchlist: string | null,
  categoryCount: number
): string {
  if (watchlist) return `Watchlist: ${watchlist}`;
  return `Latest papers from ${categoryCount} ${
    categoryCount === 1 ? "category" : "categories"
  }`;
}

/**
 * Validate view parameter from URL
 */
export function parseViewFromURL(viewParam: string | null): ViewTab {
  const VALID_VIEWS = ["today", "week", "for-you"] as const;
  if (viewParam && (VALID_VIEWS as readonly string[]).includes(viewParam)) {
    return viewParam as ViewTab;
  }
  // Default to "today" to match FEED_CONFIG
  return "today";
}
