// components/watchlists/watchlist-list.tsx
"use client";

import * as React from "react";
import { Edit3, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Users } from "lucide-react";

import TypePill from "./type-pill";
import type { WatchlistItem } from "@/types/watchlists";

export default function WatchlistList({
  items,
  onEdit,
  onDelete,
  onNew,
  isEditing,
}: {
  items: WatchlistItem[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
  isEditing?: boolean;
}) {
  if (!items.length) {
    return (
      <section className="rounded-xl border bg-card p-4">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Users className="h-6 w-6 text-muted-foreground" />
            </EmptyMedia>
            <EmptyTitle>No watchlists</EmptyTitle>
            <EmptyDescription>
              Create your first watchlist to personalize your feed.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={onNew} disabled={isEditing}>
              Create watchlist
            </Button>
          </EmptyContent>
        </Empty>
      </section>
    );
  }

  return (
    <section className="rounded-xl border bg-card p-4">
      <div className="mb-2 text-sm font-medium">Your watchlists</div>
      <ul className="grid gap-2 md:grid-cols-2">
        {items.map((w) => (
          <li key={w.id} className="rounded-lg border bg-card/80 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <TypePill type={w.type} />
                  <div className="truncate font-medium">{w.name}</div>
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {w.terms.map((t) => (
                    <Badge
                      key={t}
                      variant="secondary"
                      className="border px-1.5 py-0.5 text-[10px]"
                    >
                      {t}
                    </Badge>
                  ))}
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {w.categories.map((c) => (
                    <Badge
                      key={c}
                      variant="outline"
                      className="px-1.5 py-0.5 text-[10px]"
                    >
                      {c}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => onEdit(w.id)}
                  disabled={isEditing && w.id !== undefined}
                >
                  <Edit3 className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => onDelete(w.id)}
                  disabled={isEditing}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
