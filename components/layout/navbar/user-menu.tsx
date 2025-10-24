
// components/layout/user-menu.tsx
"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getUserDisplayName, getUserInitials } from "@/lib/utils/user";
import type { User } from "@/types/auth";
import {
  Loader2,
  LogIn,
  LogOut,
  Settings,
  User as UserIcon,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

interface UserMenuProps {
  user: User | null;
  isLoading: boolean;
  onSignOut: () => Promise<void>;
}

export function UserMenu({ user, isLoading, onSignOut }: UserMenuProps) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  const [signingOut, setSigningOut] = useState(false);

  const next = useMemo(() => {
    const qs = search?.toString();
    const current = qs ? `${pathname}?${qs}` : pathname || "/";
    return encodeURIComponent(current);
  }, [pathname, search]);

  const handleSignIn = () => {
    router.push(`/auth/sign-in?next=${next}`);
  };

  const handleSettings = () => {
    router.push("/settings/account");
  };

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await onSignOut();
    } catch (error) {
      // No-op or show toast
      console.error("Sign out error:", error);
    } finally {
      setSigningOut(false);
    }
  };

  const displayName = getUserDisplayName(user);
  const avatarAlt = user ? `${displayName}'s avatar` : "User avatar";

  // UX: Only show spinner while actually signing out (not during initial auth load)
  const showSpinnerInAvatar = signingOut;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="px-2 focus-visible:ring-2 focus-visible:ring-primary"
          disabled={signingOut}
          aria-label={user ? `Account menu for ${displayName}` : "Account menu"}
          // aria-busy only when signing out to avoid "spinning account" UX when signed-out
          aria-busy={signingOut}
        >
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              {user?.avatar ? (
                <AvatarImage src={user.avatar} alt={avatarAlt} />
              ) : (
                <AvatarFallback className="text-xs">
                  {showSpinnerInAvatar ? (
                    <Loader2
                      className="h-3.5 w-3.5 animate-spin"
                      aria-hidden="true"
                    />
                  ) : user ? (
                    getUserInitials(displayName)
                  ) : (
                    <UserIcon className="h-4 w-4" aria-hidden="true" />
                  )}
                </AvatarFallback>
              )}
            </Avatar>
            <span className="hidden sm:inline text-sm max-w-[160px] truncate">
              {user ? displayName : "Sign in"}
            </span>
          </div>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64">
        {user ? (
          <>
            <DropdownMenuLabel className="space-y-0.5">
              <div className="truncate font-medium">{displayName}</div>
              {user.email ? (
                <div className="truncate text-xs text-muted-foreground">
                  {user.email}
                </div>
              ) : null}
            </DropdownMenuLabel>

            <DropdownMenuSeparator />

            <DropdownMenuItem onClick={handleSettings}>
              <Settings className="mr-2 h-4 w-4" aria-hidden="true" />
              Settings
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={handleSignOut}
              disabled={signingOut}
              className="text-destructive focus:text-destructive"
            >
              {signingOut ? (
                <Loader2
                  className="mr-2 h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
              )}
              Sign out
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuLabel>Welcome</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignIn} disabled={isLoading}>
              <LogIn className="mr-2 h-4 w-4" aria-hidden="true" />
              Sign in
            </DropdownMenuItem>
            {/* If you don't want guests to see Feed at all, remove the option below */}
            {/* <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/feed">Continue without an account</Link>
            </DropdownMenuItem> */}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}