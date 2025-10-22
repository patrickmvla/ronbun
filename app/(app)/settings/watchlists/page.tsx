// app/(app)/settings/watchlists/page.tsx
import { Suspense } from "react";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import WatchlistsContent from "@/components/settings/watchlists-content";

export const dynamic = "force-dynamic";

export default function WatchlistsPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-7xl">
          <div className="flex flex-col gap-2 pb-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Watchlists</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Follow keywords, authors, benchmarks, or institutions. Your feed and weekly digest use these.
              </p>
            </div>
            <div className="flex gap-2">
              <Button disabled variant="secondary">New watchlist</Button>
            </div>
          </div>
          <Separator className="mb-4 opacity-50" />
          <section className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
            Loading watchlists…
          </section>
        </div>
      }
    >
      <WatchlistsContent />
    </Suspense>
  );
}