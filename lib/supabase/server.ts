/* eslint-disable @typescript-eslint/no-explicit-any */
// lib/supabase/server.ts
import { cookies } from "next/headers";
import {
  createServerClient,
  type CookieMethodsServer,
} from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

function isHttpUrl(url?: string | null) {
  if (!url) return false;
  try {
    const u = new URL(url.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

// Node runtime only. Do not import in Edge routes.
// RSC/Server components: must await cookies() before use in your setup.
export async function createClient(): Promise<SupabaseClient | null> {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const rawKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!isHttpUrl(rawUrl) || !rawKey) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        `[supabase] Missing/invalid env. URL=${
          rawUrl ? `"${rawUrl}"` : "unset"
        } KEY=${rawKey ? "set" : "unset"} — Auth disabled for this request.`
      );
    }
    return null;
  }

  const url = rawUrl as string;
  const key = rawKey as string;

  // IMPORTANT: await cookies() here to satisfy Next's dynamic API requirements
  const cookieStore = await cookies();

  const cookieAdapter: CookieMethodsServer = {
    getAll() {
      try {
        // Map Next cookies → { name, value }[]
        return cookieStore.getAll().map(({ name, value }) => ({ name, value }));
      } catch {
        return [];
      }
    },
    setAll(cookiesToSet) {
      // In RSC, cookies are often read-only; guard set()
      try {
       
        if (typeof (cookieStore as any).set !== "function") return;
        cookiesToSet.forEach(({ name, value, options }) => {
          (cookieStore as any).set(name, value, options);
        });
      } catch {
        // no-op
      }
    },
  };

  return createServerClient(url, key, { cookies: cookieAdapter });
}

// Route handlers: bind cookies to a response so refreshed/cleared auth cookies persist.
// Usage:
// export async function POST(req: NextRequest) {
//   const res = NextResponse.next();
//   const supabase = createRouteClient(req, res);
//   await supabase?.auth.getSession(); // refresh cookies if needed
//   return res;
// }
export function createRouteClient(
  req: NextRequest,
  res: NextResponse
): SupabaseClient | null {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const rawKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!isHttpUrl(rawUrl) || !rawKey) return null;

  const url = rawUrl as string;
  const key = rawKey as string;

  const cookieAdapter: CookieMethodsServer = {
    getAll() {
      return req.cookies.getAll();
    },
    setAll(cookiesToSet) {
      cookiesToSet.forEach(({ name, value, options }) => {
        res.cookies.set(name, value, options);
      });
    },
  };

  return createServerClient(url, key, { cookies: cookieAdapter });
}

// Helper for server routes that need to return JSON while carrying auth cookies
export function attachAuthCookies(from: NextResponse, to: NextResponse): NextResponse {
  for (const c of from.cookies.getAll()) {
    to.cookies.set(c);
  }
  return to;
}