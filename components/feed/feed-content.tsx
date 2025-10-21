import { ArrowRight, Loader2, CircleAlert, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PaperRow, PaperRowSkeleton } from "@/components/papers/paper-row";
import type { PaperListItem } from "@/hooks/useInfinitePapers";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

interface FeedContentProps {
  papers: PaperListItem[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: Error | null;
  onLoadMore: () => void;
  onRetry: () => void;
  onReset: () => void;
  sentinelRef: React.Ref<HTMLDivElement>;
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
  if (isLoading) {
    return (
      <div className="grid gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <PaperRowSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (error) {
    const errMsg = error instanceof Error ? error.message : "Please try again shortly.";
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CircleAlert className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>Can’t load papers</EmptyTitle>
          <EmptyDescription>{errMsg}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="secondary" onClick={onRetry}>
            Retry
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  if (papers.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SearchX className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>No papers found</EmptyTitle>
          <EmptyDescription>Try different categories or a broader time range.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="secondary" onClick={onReset}>
            Reset filters
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <>
      <div className="grid gap-3" aria-busy={isLoadingMore || undefined}>
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
              pdfUrl: paper.pdfUrl ?? undefined,
              // pass enrichment so badges/buttons render
              codeUrls: paper.codeUrls ?? [],
            }}
          />
        ))}

        <div ref={sentinelRef} aria-hidden="true" className="h-1" />
      </div>

      <div className="flex items-center justify-center py-6" aria-live="polite">
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
          <p className="text-sm text-muted-foreground">You’ve reached the end</p>
        ) : null}
      </div>
    </>
  );
}