// lib/types/watchlists.ts
import { z } from "zod";
import { WatchlistSchema as WSchema } from "@/lib/zod";

export const DEFAULT_CATS = [
  "cs.AI",
  "cs.LG",
  "cs.CL",
  "cs.CV",
  "cs.NE",
  "stat.ML",
] as const;

export type WatchlistType = "keyword" | "author" | "benchmark" | "institution";

export const WatchlistSchema = WSchema;
export type WatchlistForm = z.infer<typeof WatchlistSchema>;

export type WatchlistItem = WatchlistForm & {
  id: string;
  createdAt?: string | null;
};