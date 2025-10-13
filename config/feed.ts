import type { ViewOption } from "@/types/feed";

export const DEFAULT_CATEGORIES = [
  "cs.AI",
  "cs.LG",
  "cs.CL",
  "cs.CV",
  "cs.NE",
  "stat.ML",
] as const;

export type DefaultCategory = (typeof DEFAULT_CATEGORIES)[number];

export const VIEW_OPTIONS: ViewOption[] = [
  {
    value: "today",
    label: "Today",
    description: "Papers from the last 24 hours",
  },
  {
    value: "week",
    label: "This Week",
    description: "Papers from the last 7 days",
  },
  {
    value: "for-you",
    label: "For You",
    description: "Personalized recommendations",
    showSparkles: true, // ✅ Flag instead of JSX
  },
];

export const FEED_CONFIG = {
  defaultView: "today" as const,
  defaultCategories: DEFAULT_CATEGORIES,
  pageSize: 25,
  sortBy: "submittedDate",
  sortOrder: "descending",
  infiniteScrollMargin: "1200px",
} as const;

export const CATEGORY_LABELS: Record<string, string> = {
  "cs.AI": "Artificial Intelligence",
  "cs.LG": "Machine Learning",
  "cs.CL": "Computation and Language",
  "cs.CV": "Computer Vision",
  "cs.NE": "Neural and Evolutionary Computing",
  "stat.ML": "Machine Learning (Statistics)",
};