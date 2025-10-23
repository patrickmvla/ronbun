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
  const initialized = useRef(false);

  useEffect(() => {
    return () => {
      mounted.current = false;
    };
  }, []);

  const setSafe = useCallback((fn: () => void) => {
    if (mounted.current) fn();
  }, []);

  const finishInit = useCallback(() => {
    if (!initialized.current) {
      initialized.current = true;
      setSafe(() => setIsLoading(false));
    }
  }, [setSafe]);

  // Load current session and derive user (initial)
  const loadFromSession = useCallback(async () => {
    if (!supabase) {
      setSafe(() => {
        setUser(null);
        setIsLoading(false);
      });
      return;
    }
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error && process.env.NODE_ENV !== "production") {
        console.warn("auth.getSession error:", error.message);
      }
      const sessionUser = data?.session?.user ?? null;
      setSafe(() => {
        setUser(mapSupabaseUser(sessionUser));
      });
    } finally {
      finishInit();
    }
  }, [supabase, setSafe, finishInit]);

  // Auth change handler (covers INITIAL_SESSION too)
  const handleAuthChange = useCallback(
    (event: AuthChangeEvent, session: Session | null) => {
      const mapped = mapSupabaseUser(session?.user ?? null);
      setSafe(() => {
        setUser(mapped);
        setIsLoading(false);
      });

      // React to auth lifecycle
      if (event === "SIGNED_OUT") {
        // Navigate to sign-in and ensure SSR sees signed-out state
        router.replace("/auth/sign-in");
      } else if (
        event === "SIGNED_IN" ||
        event === "TOKEN_REFRESHED" ||
        event === "USER_UPDATED" ||
        event === "INITIAL_SESSION"
      ) {
        // Ensure server components re-fetch with the new auth cookies
        try {
          router.refresh();
        } catch {}
      }
    },
    [router, setSafe]
  );

  // Initialize: load session and subscribe to auth changes
  useEffect(() => {
    if (!supabase) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    // Fail-safe: never hang loading forever
    const fail = setTimeout(() => {
      finishInit();
    }, 1500);

    // 1) Kick off initial session load
    loadFromSession();

    // 2) Subscribe to auth changes (includes INITIAL_SESSION)
    const { data } = supabase.auth.onAuthStateChange(handleAuthChange);
    const sub = data?.subscription;

    return () => {
      clearTimeout(fail);
      sub?.unsubscribe();
    };
  }, [supabase, loadFromSession, handleAuthChange, finishInit]);

  // Public API
  const signOut = useCallback(async () => {
    // If client missing, just bounce
    if (!supabase) {
      router.replace("/auth/sign-in");
      return;
    }
    try {
      setSafe(() => setIsLoading(true));

      // 1) Clear browser/local session (broadcasts SIGNED_OUT)
      await supabase.auth.signOut();

      // 2) Clear SSR cookies so server components don't see a ghost session
      try {
        await fetch("/api/auth/signout", { method: "POST", cache: "no-store" });
      } catch {
        // Non-fatal; continue
      }

      // 3) Local state + redirect
      setSafe(() => setUser(null));
      router.replace("/auth/sign-in");

      // Optional nuclear option if you still see stale UI:
      // window.location.assign("/auth/sign-in");
    } catch (err) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("signOut error:", (err as any)?.message || err);
      }
      router.replace("/auth/sign-in");
    } finally {
      setSafe(() => setIsLoading(false));
    }
  }, [supabase, router, setSafe]);

  const refresh = useCallback(async () => {
    setSafe(() => setIsLoading(true));
    await loadFromSession();
  }, [loadFromSession, setSafe]);

  return { user, isLoading, signOut, refresh };
}