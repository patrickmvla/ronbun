/* eslint-disable @typescript-eslint/no-explicit-any */
// hooks/use-watchlists.ts
"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { z } from "zod";
import { WatchlistSchema as WSchema } from "@/lib/zod";
import type { WatchlistItem } from "@/types/watchlists";

type WatchlistForm = z.infer<typeof WSchema>;
type CreatePayload = Omit<WatchlistForm, "id">;

type WatchlistsResponse = {
  items: WatchlistItem[];
  unauthorized: boolean;
};

const EMPTY_ITEMS: WatchlistItem[] = [];

async function fetchWatchlists(): Promise<WatchlistsResponse> {
  const res = await fetch("/api/user/watchlists", { method: "GET" });
  if (res.status === 401) return { items: [], unauthorized: true };
  if (!res.ok) throw new Error("Failed to fetch watchlists");
  const data = await res.json();
  return { items: (data.items ?? []) as WatchlistItem[], unauthorized: false };
}

async function createWatchlist(
  values: CreatePayload
): Promise<{ item: WatchlistItem }> {
  const res = await fetch("/api/user/watchlists", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(values),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Failed to create watchlist");
  return data as { item: WatchlistItem };
}

async function updateWatchlistApi(
  payload: WatchlistForm & { id: string }
): Promise<{ item: WatchlistItem }> {
  const res = await fetch("/api/user/watchlists", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Failed to update watchlist");
  return data as { item: WatchlistItem };
}

async function deleteWatchlistApi(id: string): Promise<{ ok: true }> {
  const res = await fetch("/api/user/watchlists", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Failed to delete watchlist");
  return data as { ok: true };
}

export function useWatchlists() {
  const qc = useQueryClient();
  const [editingId, setEditingId] = React.useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["watchlists"],
    queryFn: fetchWatchlists,
    retry: 2,
  });

  const items = React.useMemo<WatchlistItem[]>(
    () => (data?.items ? data.items : EMPTY_ITEMS),
    [data?.items]
  );
  const unauthorized = React.useMemo<boolean>(
    () => Boolean(data?.unauthorized),
    [data?.unauthorized]
  );

  const createMut = useMutation({
    mutationFn: createWatchlist,
    onMutate: async (values) => {
      await qc.cancelQueries({ queryKey: ["watchlists"] });
      const prev = qc.getQueryData<WatchlistsResponse>(["watchlists"]);
      const optimistic: WatchlistItem = {
        ...(values as any),
        id: `temp-${Date.now()}`,
        createdAt: new Date().toISOString(),
      };
      if (prev) {
        qc.setQueryData<WatchlistsResponse>(["watchlists"], {
          items: [optimistic, ...prev.items],
          unauthorized: false,
        });
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["watchlists"], ctx.prev);
    },
    onSuccess: ({ item }) => {
      qc.setQueryData<WatchlistsResponse>(["watchlists"], (old) => {
        if (!old) return { items: [item], unauthorized: false };
        const next = old.items.slice();
        const idx = next.findIndex((w) => w.id.startsWith("temp-"));
        if (idx >= 0) next[idx] = item;
        else next.unshift(item);
        return { items: next, unauthorized: false };
      });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["watchlists"] }),
  });

  const updateMut = useMutation({
    mutationFn: updateWatchlistApi,
    onMutate: async (payload) => {
      await qc.cancelQueries({ queryKey: ["watchlists"] });
      const prev = qc.getQueryData<WatchlistsResponse>(["watchlists"]);
      if (prev) {
        qc.setQueryData<WatchlistsResponse>(["watchlists"], {
          items: prev.items.map((it) =>
            it.id === (payload as any).id
              ? ({ ...(payload as any) } as WatchlistItem)
              : it
          ),
          unauthorized: false,
        });
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["watchlists"], ctx.prev);
    },
    onSuccess: ({ item }) => {
      qc.setQueryData<WatchlistsResponse>(["watchlists"], (old) => {
        if (!old) return { items: [item], unauthorized: false };
        return {
          items: old.items.map((it) => (it.id === item.id ? item : it)),
          unauthorized: false,
        };
      });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["watchlists"] }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteWatchlistApi(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["watchlists"] });
      const prev = qc.getQueryData<WatchlistsResponse>(["watchlists"]);
      if (prev) {
        qc.setQueryData<WatchlistsResponse>(["watchlists"], {
          items: prev.items.filter((it) => it.id !== id),
          unauthorized: false,
        });
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["watchlists"], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["watchlists"] }),
  });

  const addWatchlist = (values: WatchlistForm) =>
    createMut.mutateAsync(values as CreatePayload);

  const updateWatchlist = (id: string, values: WatchlistForm) =>
    updateMut.mutateAsync({ ...(values as any), id });

  const deleteWatchlist = (id: string) => {
    const ok = confirm("Delete this watchlist?");
    if (!ok) return Promise.resolve();
    return deleteMut.mutateAsync(id);
  };

  const beginEdit = (id: string) => setEditingId(id);
  const cancelEdit = () => setEditingId(null);

  const editingItem = React.useMemo(
    () => items.find((w) => w.id === editingId) || null,
    [items, editingId]
  );

  return {
    items,
    editingId,
    editingItem,
    addWatchlist,
    updateWatchlist,
    deleteWatchlist,
    beginEdit,
    cancelEdit,
    isLoading,
    isError,
    unauthorized,
    isCreating: createMut.isPending,
    isUpdating: updateMut.isPending,
    isDeleting: deleteMut.isPending,
  };
}
