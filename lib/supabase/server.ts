/* eslint-disable @typescript-eslint/no-explicit-any */
// lib/supabase/server.ts
import { cookies } from "next/headers";
import {
  createServerClient,
  type CookieMethodsServer,
} from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

function isHttpUrl(url?: string | null) {
  if (!url) return false;
  try {
    const u = new URL(url.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function isPromise<T = unknown>(v: any): v is Promise<T> {
  return !!v && typeof v.then === "function";
}

// Node runtime only. Do not import in Edge routes.
export async function createClient(): Promise<SupabaseClient | null> {
  // Read raw envs (can be undefined at type-level)
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const rawKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Runtime guard + early exit (prevents crashes in dev)
  if (!isHttpUrl(rawUrl) || !rawKey) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        `[supabase] Missing/invalid env. URL=${rawUrl ? `"${rawUrl}"` : "unset"} KEY=${rawKey ? "set" : "unset"} — Auth disabled for this request.`
      );
    }
    return null;
  }

  // After guards, assert to string so TS sees the correct overload
  const url = rawUrl as string;
  const key = rawKey as string;

  // Support both Next 14 (Promise) and Next 15 (sync) cookies()
  const cookieStoreMaybe = cookies() as any;
  const cookieStore = isPromise(cookieStoreMaybe) ? await cookieStoreMaybe : cookieStoreMaybe;

  const cs: any = cookieStore; // normalize for differing Next types

  // Use the new cookie adapter API; typing forces non-deprecated overload
  const cookieAdapter: CookieMethodsServer = {
    getAll() {
      try {
        const all = typeof cs.getAll === "function" ? cs.getAll() : [];
        return all.map(({ name, value }: any) => ({ name, value }));
      } catch {
        return [];
      }
    },
    setAll(cookiesToSet) {
      // In RSC, cookies are read-only; .set won’t exist—safely ignore
      try {
        if (typeof cs.set !== "function") return;
        for (const { name, value, options } of cookiesToSet) {
          cs.set(name, value, options);
        }
      } catch {
        // no-op
      }
    },
  };

  return createServerClient(url, key, { cookies: cookieAdapter });
}