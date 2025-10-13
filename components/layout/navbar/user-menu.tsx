"use client";

import { useRouter } from "next/navigation";
import { LogIn, LogOut, Settings, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getUserInitials, getUserDisplayName } from "@/lib/utils/user";
import type { User } from "@/types/auth";

interface UserMenuProps {
  user: User | null;
  isLoading: boolean;
  onSignOut: () => Promise<void>;
}

export function UserMenu({ user, isLoading, onSignOut }: UserMenuProps) {
  const router = useRouter();

  const handleSignIn = () => {
    router.push("/auth/sign-in");
  };

  const handleSettings = () => {
    router.push("/settings/watchlists");
  };

  const handleSignOut = async () => {
    try {
      await onSignOut();
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="px-2 focus-visible:ring-2 focus-visible:ring-primary"
          disabled={isLoading}
          aria-label={user ? `Account menu for ${user.name}` : "Account menu"}
        >
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              {user?.avatar ? (
                <AvatarImage
                  src={user.avatar}
                  alt={`${user.name}'s avatar`}
                />
              ) : (
                <AvatarFallback className="text-xs">
                  {user ? (
                    getUserInitials(user.name)
                  ) : (
                    <UserIcon className="h-4 w-4" aria-hidden="true" />
                  )}
                </AvatarFallback>
              )}
            </Avatar>
            <span className="hidden sm:inline text-sm">
              {getUserDisplayName(user)}
            </span>
          </div>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60">
        {user ? (
          <>
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span className="truncate font-medium">{user.name}</span>
                <span className="truncate text-xs font-normal text-muted-foreground">
                  {user.email}
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSettings}>
              <Settings className="mr-2 h-4 w-4" aria-hidden="true" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
              Sign out
            </DropdownMenuItem>
          </>
        ) : (
          <DropdownMenuItem onClick={handleSignIn}>
            <LogIn className="mr-2 h-4 w-4" aria-hidden="true" />
            Sign in
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}