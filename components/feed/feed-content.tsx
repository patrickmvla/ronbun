import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PaperRow, PaperRowSkeleton } from "@/components/papers/paper-row";
import { EmptyState } from "./empty-state";
import type { PaperListItem } from "@/hooks/useInfinitePapers";

interface FeedContentProps {
  papers: PaperListItem[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: Error | null;
  onLoadMore: () => void;
  onRetry: () => void;
  onReset: () => void;
  sentinelRef: React.RefObject<HTMLDivElement>; // ✅ Remove null
}

export function FeedContent({
  papers,
  isLoading,
  isLoadingMore,
  hasMore,
  error,
  onLoadMore,
  onRetry,
  onReset,
  sentinelRef,
}: FeedContentProps) {
  // Initial loading state
  if (isLoading) {
    return (
      <div className="grid gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <PaperRowSkeleton key={i} />
        ))}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <EmptyState
        title="Can't load papers"
        description={error.message || "Please try again shortly."}
        action={
          <Button variant="secondary" onClick={onRetry}>
            Retry
          </Button>
        }
      />
    );
  }

  // Empty state
  if (papers.length === 0) {
    return (
      <EmptyState
        title="No papers found"
        description="Try different categories or a broader time range."
        action={
          <Button variant="secondary" onClick={onReset}>
            Reset filters
          </Button>
        }
      />
    );
  }

  // Papers list
  return (
    <>
      <div className="grid gap-3">
        {papers.map((paper) => (
          <PaperRow
            key={paper.arxivId}
            paper={{
              arxivId: paper.arxivId,
              title: paper.title,
              summary: paper.summary,
              authors: paper.authors,
              categories: paper.categories,
              published: paper.published,
              updated: paper.updated,
              pdfUrl: paper.pdfUrl,
            }}
          />
        ))}

        {/* Intersection observer sentinel */}
        <div ref={sentinelRef} aria-hidden="true" />
      </div>

      {/* Load more footer */}
      <div className="flex items-center justify-center py-6">
        {isLoadingMore ? (
          <Button variant="ghost" disabled className="gap-2">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Loading…
          </Button>
        ) : hasMore ? (
          <Button onClick={onLoadMore} variant="outline" className="gap-2">
            Load more
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        ) : papers.length > 0 ? (
          <p className="text-sm text-muted-foreground">
            Youve reached the end
          </p>
        ) : null}
      </div>
    </>
  );
}