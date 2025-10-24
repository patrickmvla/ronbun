"use client";

import { Suspense, useMemo } from "react";
import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { LayoutGrid, LogIn, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MobileNav } from "./mobile-nav";
import { SearchBar } from "./search-bar";
import { UserMenu } from "./user-menu";
import { NavLink } from "./nav-link";
import { useAuth } from "@/hooks/use-auth";
import { NAV_ITEMS, NAVBAR_CONFIG } from "@/config/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

function NavbarInner() {
  const pathname = usePathname();
  const search = useSearchParams();
  const router = useRouter();
  const { user, isLoading, signOut } = useAuth();

  // Build ?next param for returning after auth
  const next = useMemo(() => {
    const qs = search?.toString();
    const current = qs ? `${pathname}?${qs}` : pathname || "/";
    return encodeURIComponent(current);
  }, [pathname, search]);

  const handleSignIn = () => {
    router.push(`/auth/sign-in?next=${next}`);
  };

  // Hide feed/compare/watchlists when not signed in
  const visibleNavItems = useMemo(() => {
    if (user) return NAV_ITEMS;
    const hidden = ["/feed", "/compare", "/settings/watchlists", "/watchlists"];
    return NAV_ITEMS.filter((it) => !hidden.some((p) => it.href.startsWith(p)));
  }, [user]);

  return (
    <nav
      className="sticky top-0 z-50 border-b backdrop-blur supports-[backdrop-filter]:bg-background/70"
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="mx-auto max-w-7xl px-3 sm:px-4">
        <div className="flex h-14 items-center gap-2">
          {/* Mobile menu (hide when signed out to avoid blocked links) */}
          <div className="flex lg:hidden">{user ? <MobileNav currentPath={pathname} /> : null}</div>

          {/* Brand */}
          <Link
            href="/"
            className="flex items-center gap-2 focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Ronbun home"
          >
            <div className="inline-flex h-8 w-8 items-center justify-center rounded-md border bg-card">
              <LayoutGrid className="h-4 w-4 text-primary" aria-hidden="true" />
            </div>
            <span className="font-semibold tracking-tight">{NAVBAR_CONFIG.brandName}</span>
            <span
              lang="ja"
              className="hidden align-baseline text-xs text-muted-foreground sm:inline"
              aria-label="Ronbun in Japanese"
            >
              {NAVBAR_CONFIG.brandNameJa}
            </span>
            <Badge
              variant="secondary"
              className="hidden border border-primary/30 text-primary sm:inline-flex"
            >
              beta
            </Badge>
          </Link>

          {/* Desktop navigation */}
          <div className="ml-4 hidden items-center gap-1 lg:flex" role="list">
            {visibleNavItems.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                isActive={pathname?.startsWith(item.href) ?? false}
              />
            ))}
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Search (hide when not signed in) */}
          {user ? (
            <Suspense
              fallback={
                <div className="hidden min-w-[320px] max-w-md md:flex">
                  <div className="h-9 w-full rounded-md border bg-muted/30" />
                </div>
              }
            >
              <SearchBar className="hidden min-w-[320px] max-w-md md:flex" />
            </Suspense>
          ) : null}

          {/* Actions */}
          <div className="flex items-center gap-1">
            {user ? (
              // Signed-in → full UserMenu (contains Avatar)
              <UserMenu user={user} isLoading={isLoading} onSignOut={signOut} />
            ) : (
              // Signed-out → Sign in button with Avatar fallback (no spinner)
              <Button
                size="sm"
                variant="outline"
                onClick={handleSignIn}
                disabled={isLoading}
                aria-label="Sign in"
                className="gap-2"
              >
                <Avatar className="h-6 w-6">
                  <AvatarImage src="" alt="Guest" />
                  <AvatarFallback className="p-0">
                    <UserIcon className="h-4 w-4" aria-hidden="true" />
                  </AvatarFallback>
                </Avatar>
                <LogIn className="h-4 w-4 sm:ml-0.5" aria-hidden="true" />
                <span className="hidden sm:inline">Sign in</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

export default function Navbar() {
  // Wrap the component that calls next/navigation hooks in Suspense
  return (
    <Suspense
      fallback={
        <nav
          className="sticky top-0 z-50 border-b backdrop-blur supports-[backdrop-filter]:bg-background/70"
          role="navigation"
          aria-label="Main navigation"
        >
          <div className="mx-auto max-w-7xl px-3 sm:px-4">
            <div className="flex h-14 items-center gap-2">
              {/* Brand (skeleton) */}
              <div className="flex items-center gap-2" aria-label="Ronbun (loading)">
                <div className="inline-flex h-8 w-8 items-center justify-center rounded-md border bg-card" />
                <span className="h-4 w-24 rounded bg-muted/30" />
              </div>
              <div className="flex-1" />
              <div className="hidden min-w-[320px] max-w-md md:flex">
                <div className="h-9 w-full rounded-md border bg-muted/30" />
              </div>
              <div className="h-8 w-24 rounded-md border bg-muted/30" />
            </div>
          </div>
        </nav>
      }
    >
      <NavbarInner />
    </Suspense>
  );
}