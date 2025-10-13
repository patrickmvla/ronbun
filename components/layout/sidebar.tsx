
"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Newspaper,
  GitCompare,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Plus,
} from "lucide-react";
import { useSidebar } from "@/stores/useSidebar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

type Item = { label: string; href: string; icon: LucideIcon };

const primaryNav: Item[] = [
  { label: "Feed", href: "/feed", icon: Newspaper },
  { label: "Compare", href: "/compare", icon: GitCompare },
  { label: "Watchlists", href: "/settings/watchlists", icon: Bookmark },
];

// Mock watchlists (UI-first)
const mockWatchlists = [
  { id: "wl-1", name: "Advisor + Lab" },
  { id: "wl-2", name: "MMLU + GSM8K" },
  { id: "wl-3", name: "Distillation | SSM" },
  { id: "wl-4", name: "RAG + VLM" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { collapsed, toggle } = useSidebar();

  const width = collapsed ? "w-16" : "w-64";
  const labelCls = collapsed ? "opacity-0 pointer-events-none" : "opacity-100";
  const padX = collapsed ? "px-2" : "px-3";

  const isActive = (href: string) => (pathname ?? "").startsWith(href);
  const isFeed = (pathname ?? "").startsWith("/feed");
  const selectedWl = searchParams.get("wl"); // e.g., "wl-2" or null

  const navId = "sidebar-primary-nav";
  const watchlistId = "sidebar-watchlists";

  return (
    <aside
      role="complementary"
      aria-label="Sidebar"
      data-collapsed={collapsed ? "true" : "false"}
      className={[
        // visible on md+ to align with app layout
        "hidden md:flex sticky top-0 h-dvh shrink-0 flex-col",
        // theme tokens
        "bg-sidebar text-sidebar-foreground border-r border-sidebar-border",
        // width + motion
        width,
        "transition-[width] duration-200 ease-out",
      ].join(" ")}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-2">
        <div
          className={[
            "truncate text-sm font-semibold tracking-tight",
            collapsed ? "px-2" : "px-3",
          ].join(" ")}
          title="Ronbun"
          aria-label="Ronbun"
        >
          {collapsed ? "R" : "Ronbun"}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          aria-controls={`${navId} ${watchlistId}`}
          className="text-muted-foreground hover:text-foreground"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      <Separator className="mx-2" />

      {/* Primary nav */}
      <nav id={navId} className="mt-2 px-1">
        <ul className="space-y-1">
          {primaryNav.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  title={collapsed ? item.label : undefined}
                  className={[
                    "group relative flex items-center gap-3 rounded-md py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                    padX,
                    active
                      ? "bg-accent text-foreground ring-1 ring-ring"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent",
                  ].join(" ")}
                >
                  {/* active indicator */}
                  <span
                    className={[
                      "pointer-events-none absolute left-0 top-2 bottom-2 w-px",
                      active
                        ? "bg-gradient-to-b from-primary/0 via-primary/70 to-primary/0"
                        : "bg-transparent",
                    ].join(" ")}
                    aria-hidden="true"
                  />
                  <Icon className="h-4 w-4 text-primary/90 group-hover:text-primary" />
                  <span
                    className={[
                      "transition-opacity duration-200",
                      labelCls,
                    ].join(" ")}
                  >
                    {item.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <Separator className="my-3 mx-2" />

      {/* Watchlists */}
      <div id={watchlistId} className="px-2">
        <div className="mb-2 flex items-center justify-between">
          <span
            className={[
              "text-xs uppercase tracking-wide text-muted-foreground",
              "transition-opacity",
              labelCls,
            ].join(" ")}
          >
            Watchlists
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground"
            title="New watchlist"
            aria-label="Create watchlist"
            onClick={() => alert("Create watchlist (mock)")}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto pr-1">
          <ul className="space-y-1">
            {mockWatchlists.map((w) => {
              const href = `/feed?wl=${w.id}`;
              const active = isFeed && selectedWl === w.id;
              return (
                <li key={w.id}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    title={collapsed ? w.name : undefined}
                    className={[
                      "group relative flex items-center gap-3 rounded-md py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                      padX,
                      active
                        ? "bg-accent text-foreground ring-1 ring-ring"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent",
                    ].join(" ")}
                  >
                    {/* active dot/indicator */}
                    <span
                      className={[
                        "relative grid h-2 w-2 place-items-center rounded-full",
                        active ? "bg-primary" : "bg-primary/70",
                      ].join(" ")}
                    >
                      <span className="absolute h-3.5 w-3.5 rounded-full bg-primary/10" />
                    </span>
                    <span
                      className={[
                        "truncate transition-opacity duration-200",
                        labelCls,
                      ].join(" ")}
                    >
                      {w.name}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-auto p-2">
        <div
          className={[
            "text-[10px] text-muted-foreground/80",
            collapsed ? "px-1 text-center" : "px-2",
          ].join(" ")}
        >
          v0.1.0 • <span className="text-primary">dark</span>
        </div>
      </div>
    </aside>
  );
}