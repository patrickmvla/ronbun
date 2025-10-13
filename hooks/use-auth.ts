"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { mapSupabaseUser } from "@/lib/utils/user";
import type { UseAuthReturn, User } from "@/types/auth";
import type { AuthChangeEvent, Session, SupabaseClient } from "@supabase/supabase-js";

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  
  // Create client and handle null case
  const supabase = useMemo(() => {
    try {
      return createClient();
    } catch (error) {
      console.error("Failed to create Supabase client:", error);
      return null;
    }
  }, []);

  // Load current user
  const loadUser = useCallback(async () => {
    // If no client, we can't load user
    if (!supabase) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.getUser();
      
      if (error) {
        console.error("Error loading user:", error);
        setUser(null);
        return;
      }

      setUser(mapSupabaseUser(data.user));
    } catch (error) {
      console.error("Unexpected error loading user:", error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  // Handle auth state changes
  const handleAuthChange = useCallback(
    (event: AuthChangeEvent, session: Session | null) => {
      const newUser = mapSupabaseUser(session?.user);
      setUser(newUser);
      setIsLoading(false);

      // Optional: handle specific events
      if (event === "SIGNED_OUT") {
        router.push("/auth/sign-in");
      } else if (event === "SIGNED_IN") {
        router.refresh();
      }
    },
    [router]
  );

  // Sign out
  const signOut = useCallback(async () => {
    if (!supabase) {
      // No client available, just redirect
      router.push("/auth/sign-in");
      return;
    }

    try {
      setIsLoading(true);
      await supabase.auth.signOut();
      setUser(null);
      router.push("/auth/sign-in");
    } catch (error) {
      console.error("Error signing out:", error);
      // Still redirect even if sign out fails
      router.push("/auth/sign-in");
    } finally {
      setIsLoading(false);
    }
  }, [supabase, router]);

  // Refresh user data
  const refresh = useCallback(async () => {
    setIsLoading(true);
    await loadUser();
  }, [loadUser]);

  // Initialize auth listener
  useEffect(() => {
    // Early return if no client
    if (!supabase) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(handleAuthChange);

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, loadUser, handleAuthChange]);

  return {
    user,
    isLoading,
    signOut,
    refresh,
  };
}