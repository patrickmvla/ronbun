// components/watchlists/type-pill.tsx
"use client";

import * as React from "react";
import { Tag, Users, Landmark, BarChart3 } from "lucide-react";
import type { WatchlistType } from "@/types/watchlists";

export default function TypePill({ type }: { type: WatchlistType }) {
  const map: Record<WatchlistType, { label: string; icon: React.ReactNode }> = {
    keyword: {
      label: "Keyword",
      icon: <Tag className="h-3.5 w-3.5 text-primary" />,
    },
    author: {
      label: "Author",
      icon: <Users className="h-3.5 w-3.5 text-primary" />,
    },
    benchmark: {
      label: "Benchmark",
      icon: <BarChart3 className="h-3.5 w-3.5 text-primary" />,
    },
    institution: {
      label: "Institution",
      icon: <Landmark className="h-3.5 w-3.5 text-primary" />,
    },
  };
  return (
    <span className="inline-flex items-center gap-1 rounded-md border bg-card/80 px-1.5 py-0.5 text-[10px]">
      {map[type].icon}
      {map[type].label}
    </span>
  );
}
