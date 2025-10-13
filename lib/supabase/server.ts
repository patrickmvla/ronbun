/* eslint-disable @typescript-eslint/no-explicit-any */
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";
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

export async function createClient(): Promise<SupabaseClient | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  // Guard missing/invalid env to avoid runtime crashes
  if (!isHttpUrl(url) || !key) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        `[supabase] Missing/invalid env. URL=${
          url ? `"${url}"` : "unset"
        } KEY=${key ? "set" : "unset"} — Auth disabled for this request.`
      );
    }
    return null;
  }

  // Next 14 returns a value; Next 15 may return a Promise. Await is safe for both.
  const cookieStore = await cookies();
  const hasSetter = typeof (cookieStore as any)?.set === "function";

  return createServerClient(url, key, {
    cookies: {
      get(name: string) {
        try {
          return cookieStore.get(name)?.value;
        } catch {
          return undefined;
        }
      },
      set(name: string, value: string, options: CookieOptions) {
        if (!hasSetter) return;
        try {
          (cookieStore as any).set({ name, value, ...options });
        } catch {
          // no-op
        }
      },
      remove(name: string, options: CookieOptions) {
        if (!hasSetter) return;
        try {
          (cookieStore as any).set({ name, value: "", ...options, maxAge: 0 });
        } catch {
          // no-op
        }
      },
    },
  });
}