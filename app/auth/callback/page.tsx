/* eslint-disable @typescript-eslint/no-explicit-any */
// app/auth/callback/page.tsx
"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";

export const dynamic = "force-dynamic";

function sanitizeNext(next: string, origin: string) {
  try {
    const u = new URL(next, origin);
    if (u.origin === origin) {
      const path = u.pathname || "/feed";
      const search = u.search || "";
      const hash = u.hash || "";
      return `${path}${search}${hash}`;
    }
  } catch {
    // ignore invalid values
  }
  return "/feed";
}

function CallbackInner() {
  const supabase = createClient();
  const router = useRouter();
  const params = useSearchParams();

  const origin =
    typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";

  const rawNext = params?.get("next") || "/feed";
  const next = useMemo(() => sanitizeNext(rawNext, origin), [rawNext, origin]);

  const urlError = params?.get("error") || params?.get("error_description");
  const [error, setError] = useState<string | null>(urlError);

  useEffect(() => {
    let cancelled = false;

    async function finishSignIn() {
      try {
        if (!supabase) {
          if (!cancelled) router.replace(next);
          return;
        }

        // If PKCE params are present, exchange them (safe to call if absent)
        try {
          await supabase.auth.exchangeCodeForSession(window.location.href);
        } catch {
          // ignore if not applicable
        }

        // Ensure session is captured from URL (detectSessionInUrl)
        const { error } = await supabase.auth.getSession();
        if (error) throw error;

        if (!cancelled) router.replace(next);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to complete sign-in.");
      }
    }

    if (!urlError) {
      finishSignIn();
    }

    return () => {
      cancelled = true;
    };
  }, [supabase, router, next, urlError]);

  if (error) {
    return (
      <div className="flex min-h-[60dvh] items-center justify-center p-6">
        <div className="space-y-4 text-center">
          <p className="text-sm font-medium">Couldn’t complete sign-in</p>
          <p className="text-xs text-muted-foreground">{error}</p>
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => router.replace("/auth/sign-in")}
              className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-3 text-primary-foreground"
            >
              Back to sign-in
            </button>
            <button
              onClick={() => router.replace(next)}
              className="inline-flex h-9 items-center justify-center rounded-md border px-3"
            >
              Continue to app
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Loading/fallback UI
  return (
    <div className="flex min-h-[60dvh] items-center justify-center p-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Finishing sign-in…
      </div>
    </div>
  );
}

export default function CallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60dvh] items-center justify-center p-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        </div>
      }
    >
      <CallbackInner />
    </Suspense>
  );
}