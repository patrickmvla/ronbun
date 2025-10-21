/* eslint-disable @typescript-eslint/no-explicit-any */
// hooks/use-auth.ts
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { mapSupabaseUser } from "@/lib/utils/user";
import type { UseAuthReturn, User } from "@/types/auth";

export function useAuth(): UseAuthReturn {
  const router = useRouter();
  const supabase = useMemo(() => {
    try {
      return createClient();
    } catch (err) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("Failed to create Supabase client:", err);
      }
      return null;
    }
  }, []);

  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const mounted = useRef(true);

  useEffect(() => {
    return () => {
      mounted.current = false;
    };
  }, []);

  const setStateSafe = useCallback((updater: () => void) => {
    if (mounted.current) updater();
  }, []);

  // Load current session and derive user
  const loadFromSession = useCallback(async () => {
    if (!supabase) {
      setStateSafe(() => {
        setUser(null);
        setIsLoading(false);
      });
      return;
    }
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("auth.getSession error:", error.message);
        }
        setStateSafe(() => {
          setUser(null);
        });
        return;
      }
      const sessionUser = data?.session?.user ?? null;
      setStateSafe(() => {
        setUser(mapSupabaseUser(sessionUser));
      });
    } finally {
      setStateSafe(() => setIsLoading(false));
    }
  }, [supabase, setStateSafe]);

  // Auth change handler
  const handleAuthChange = useCallback(
    (event: AuthChangeEvent, session: Session | null) => {
      const mapped = mapSupabaseUser(session?.user ?? null);
      setStateSafe(() => {
        setUser(mapped);
        setIsLoading(false);
      });

      if (event === "SIGNED_OUT") {
        // Avoid redirect loops; you can tweak this if you want a different behavior
        router.push("/auth/sign-in");
      } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        // Ensure server components re-fetch with the new auth cookies
        router.refresh();
      }
    },
    [router, setStateSafe]
  );

  // Initialize: load session and subscribe to auth changes
  useEffect(() => {
    if (!supabase) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    loadFromSession();

    const { data } = supabase.auth.onAuthStateChange(handleAuthChange);
    const sub = data?.subscription;

    return () => {
      sub?.unsubscribe();
    };
  }, [supabase, loadFromSession, handleAuthChange]);

  // Public API
  const signOut = useCallback(async () => {
    if (!supabase) {
      router.push("/auth/sign-in");
      return;
    }
    try {
      setStateSafe(() => setIsLoading(true));
      await supabase.auth.signOut();
      setStateSafe(() => setUser(null));
      router.push("/auth/sign-in");
    } catch (err) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("signOut error:", (err as any)?.message || err);
      }
      router.push("/auth/sign-in");
    } finally {
      setStateSafe(() => setIsLoading(false));
    }
  }, [supabase, router, setStateSafe]);

  const refresh = useCallback(async () => {
    setStateSafe(() => setIsLoading(true));
    await loadFromSession();
  }, [loadFromSession, setStateSafe]);

  return {
    user,
    isLoading,
    signOut,
    refresh,
  };
}