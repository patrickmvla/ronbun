"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MobileNav } from "./mobile-nav";
import { SearchBar } from "./search-bar";
import { UserMenu } from "./user-menu";
import { NavLink } from "./nav-link";
import { useAuth } from "@/hooks/use-auth";
import { NAV_ITEMS, NAVBAR_CONFIG } from "@/config/navigation";

export default function Navbar() {
  const pathname = usePathname();
  const { user, isLoading, signOut } = useAuth();

  return (
    <nav
      className="sticky top-0 z-50 backdrop-blur supports-[backdrop-filter]:bg-background/70 border-b"
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="mx-auto max-w-7xl px-3 sm:px-4">
        <div className="flex h-14 items-center gap-2">
          {/* Mobile menu */}
          <div className="flex lg:hidden">
            <MobileNav currentPath={pathname} />
          </div>

          {/* Brand */}
          <Link
            href="/feed"
            className="flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:rounded-md"
            aria-label="Ronbun home"
          >
            <div className="inline-flex h-8 w-8 items-center justify-center rounded-md border bg-card">
              <LayoutGrid className="h-4 w-4 text-primary" aria-hidden="true" />
            </div>
            <span className="font-semibold tracking-tight">
              {NAVBAR_CONFIG.brandName}
            </span>
            <span
              lang="ja"
              className="hidden sm:inline text-xs text-muted-foreground align-baseline"
              aria-label="Ronbun in Japanese characters"
            >
              {NAVBAR_CONFIG.brandNameJa}
            </span>
            <Badge
              variant="secondary"
              className="hidden sm:inline-flex border border-primary/30 text-primary"
            >
              beta
            </Badge>
          </Link>

          {/* Desktop navigation */}
          <div className="ml-4 hidden lg:flex items-center gap-1" role="list">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                isActive={pathname?.startsWith(item.href) ?? false}
              />
            ))}
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Search */}
          <SearchBar className="hidden md:flex min-w-[320px] max-w-md" />

          {/* Actions */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="hidden sm:inline-flex"
              aria-label="View notifications"
            >
              <Bell className="h-5 w-5" />
            </Button>
            <UserMenu user={user} isLoading={isLoading} onSignOut={signOut} />
          </div>
        </div>
      </div>
    </nav>
  );
}