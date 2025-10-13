// cspell:words watchlist

export type ViewTab = "today" | "week" | "for-you";

export interface FeedFilters {
  view: ViewTab;
  categories: string[];
  query?: string;
  watchlist?: string | null;
}

export interface FeedURLParams {
  view?: string;
  cats?: string;
  q?: string;
  wl?: string;
}

export interface ViewOption {
  value: ViewTab;
  label: string;
  description?: string;
  showSparkles?: boolean; // ✅ Boolean flag instead of ReactNode
}

export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}