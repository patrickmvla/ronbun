import { getFilterDescription } from "@/lib/utils/feed-filters";

interface FeedHeaderProps {
  watchlist: string | null;
  categoryCount: number;
}

export function FeedHeader({ watchlist, categoryCount }: FeedHeaderProps) {
  const description = getFilterDescription(watchlist, categoryCount);

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight">Your Feed</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {description} • Sorted by date
      </p>
    </div>
  );
}