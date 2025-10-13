// app/(app)/settings/watchlists/page.tsx
"use client";

import * as React from "react";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { LogIn } from "lucide-react";

import WatchlistComposer from "@/components/watchlists/watchlist-composer";
import WatchlistList from "@/components/watchlists/watchlist-list";
import { useWatchlists } from "@/hooks/use-watchlists";

export default function WatchlistsPage() {
  const {
    items,
    editingId,
    editingItem,
    addWatchlist,
    updateWatchlist,
    deleteWatchlist,
    beginEdit,
    cancelEdit,
    isLoading,
    unauthorized,
  } = useWatchlists();

  return (
    <div className="mx-auto w-full max-w-7xl">
      {/* Header */}
      <div className="flex flex-col gap-2 pb-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Watchlists</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Follow keywords, authors, benchmarks, or institutions. Your feed and weekly digest use these.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={cancelEdit} variant="secondary">New watchlist</Button>
        </div>
      </div>

      <Separator className="mb-4 opacity-50" />

      {/* Signed-out state */}
      {unauthorized ? (
        <section className="rounded-xl border bg-card p-6">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <LogIn className="h-6 w-6 text-muted-foreground" />
              </EmptyMedia>
              <EmptyTitle>Sign in to manage watchlists</EmptyTitle>
              <EmptyDescription>
                You need to be signed in to create and edit watchlists for your personalized feed and digest.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button asChild>
                <a href="/settings/account">Go to account</a>
              </Button>
            </EmptyContent>
          </Empty>
        </section>
      ) : isLoading ? (
        // Simple loading placeholder
        <section className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
          Loading watchlists…
        </section>
      ) : (
        <>
          {/* Composer (Form + Preview) */}
          <WatchlistComposer
            editingItem={editingItem}
            onCreate={(values) => addWatchlist(values)}
            onUpdate={(id, values) => updateWatchlist(id, values)}
            onCancel={cancelEdit}
          />

          {/* Existing watchlists */}
          <div className="mt-4">
            <WatchlistList
              items={items}
              onEdit={beginEdit}
              onDelete={deleteWatchlist}
              onNew={cancelEdit}
              isEditing={Boolean(editingId)}
            />
          </div>
        </>
      )}
    </div>
  );
}