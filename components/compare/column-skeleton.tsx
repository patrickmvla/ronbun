// components/compare/column-skeleton.tsx
import { Skeleton } from "@/components/ui/skeleton";

export default function ColumnSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-14 rounded-full" />
            <Skeleton className="h-3 w-36" />
          </div>
          <Skeleton className="mt-2 h-5 w-[80%]" />
          <Skeleton className="mt-1 h-3 w-[60%]" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-16 rounded-md" />
          <Skeleton className="h-8 w-14 rounded-md" />
        </div>
      </div>

      <Skeleton className="mt-3 h-6 w-24" />
      <Skeleton className="mt-2 h-16 w-full" />

      <div className="mt-3 grid gap-3">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    </div>
  );
}