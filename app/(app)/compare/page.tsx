// app/(app)/compare/page.tsx
import { Suspense } from "react";
import { Separator } from "@/components/ui/separator";
import ColumnSkeleton from "@/components/compare/column-skeleton";
import CompareContent from "@/components/compare/compare-content";

export const dynamic = "force-dynamic";

export default function ComparePage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-7xl">
          <div className="flex flex-col gap-3 pb-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Compare papers</h1>
              <p className="mt-1 text-sm text-muted-foreground">Loading compare tools…</p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
              <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="h-9 rounded-md border bg-muted/30" />
                <div className="h-9 rounded-md border bg-muted/30" />
              </div>
              <div className="flex items-center gap-2">
                <div className="h-9 w-24 rounded-md border bg-muted/30" />
                <div className="h-9 w-24 rounded-md border bg-muted/30" />
                <div className="h-9 w-24 rounded-md border bg-muted/30" />
              </div>
            </div>
          </div>
          <Separator className="mb-4 opacity-50" />
          <div className="grid gap-4 md:grid-cols-2">
            <ColumnSkeleton />
            <ColumnSkeleton />
          </div>
        </div>
      }
    >
      <CompareContent />
    </Suspense>
  );
}