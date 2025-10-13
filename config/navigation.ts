import {
  Newspaper,
  GitCompare,
  Bookmark,
} from "lucide-react";
import type { NavItem } from "@/types/navigation";

export const NAV_ITEMS: NavItem[] = [
  {
    label: "Feed",
    href: "/feed",
    icon: Newspaper,
    ariaLabel: "View paper feed",
  },
  {
    label: "Compare",
    href: "/compare",
    icon: GitCompare,
    ariaLabel: "Compare papers side-by-side",
  },
  {
    label: "Watchlists",
    href: "/settings/watchlists",
    icon: Bookmark,
    ariaLabel: "Manage your watchlists",
  },
] as const;

export const NAVBAR_CONFIG = {
  brandName: "Ronbun",
  brandNameJa: "(ロンブン)",
  searchPlaceholder: "Search papers, authors, benchmarks…",
  maxSearchLength: 200,
  navbarHeight: 56, // 14 * 4 = 56px
} as const;