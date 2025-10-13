// components/watchlists/type-segment.tsx
"use client";

import * as React from "react";
import { Tag, Users, Landmark, BarChart3 } from "lucide-react";
import type { WatchlistType } from "@/types/watchlists";

export default function TypeSegment({
  value,
  onChange,
}: {
  value: WatchlistType;
  onChange: (v: WatchlistType) => void;
}) {
  const items: { v: WatchlistType; label: string; icon: React.ReactNode }[] = [
    { v: "keyword", label: "Keyword", icon: <Tag className="h-3.5 w-3.5" /> },
    { v: "author", label: "Author", icon: <Users className="h-3.5 w-3.5" /> },
    { v: "benchmark", label: "Benchmark", icon: <BarChart3 className="h-3.5 w-3.5" /> },
    { v: "institution", label: "Institution", icon: <Landmark className="h-3.5 w-3.5" /> },
  ];
  return (
    <div className="mt-1 grid grid-cols-2 gap-1 sm:grid-cols-4">
      {items.map((it) => (
        <button
          key={it.v}
          type="button"
          onClick={() => onChange(it.v)}
          className={[
            "inline-flex items-center justify-center gap-1 rounded-md border px-2 py-1.5 text-xs transition-colors",
            value === it.v
              ? "bg-accent text-foreground ring-1 ring-ring"
              : "text-muted-foreground hover:text-foreground hover:bg-accent",
          ].join(" ")}
          aria-pressed={value === it.v}
        >
          {it.icon}
          {it.label}
        </button>
      ))}
    </div>
  );
}