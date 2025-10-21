/* eslint-disable @typescript-eslint/no-explicit-any */
// lib/auth.ts
import {
  createClient as createSupabaseJsClient,
  type SupabaseClient,
  type Session,
  type User,
} from "@supabase/supabase-js";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { createServerClient, type CookieMethodsServer } from "@supabase/ssr";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/* ================= Types ================= */

export type AuthResult = {
  supabase: SupabaseClient | null;
  session: Session | null;
  user: User | null;
};

export type RouteAuthResult = AuthResult & {
  response: NextResponse;
};

/* ================= Utils ================= */

function isHttpUrl(url?: string | null | undefined) {
  if (!url) return false;
  try {
    const u = new URL(url.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "HttpError";
  }
}

/* ================= Server components ================= */

export async function getAuth(): Promise<AuthResult> {
  const supabase = await createServerSupabase();
  if (!supabase) return { supabase: null, session: null, user: null };

  const { data, error } = await supabase.auth.getSession();
  if (error) return { supabase, session: null, user: null };

  const session = data.session ?? null;
  const user = session?.user ?? null;
  return { supabase, session, user };
}

export async function requireAuth(): Promise<{
  supabase: SupabaseClient;
  session: Session;
  user: User;
}> {
  const { supabase, session, user } = await getAuth();
  if (!supabase || !session || !user) throw new HttpError(401, "Unauthorized");
  return { supabase, session, user };
}

/* ================= Route handlers (cookie-persistent) ================= */

export async function getAuthRoute(req: NextRequest): Promise<RouteAuthResult> {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const rawKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const response = NextResponse.next();

  if (!isHttpUrl(rawUrl) || !rawKey) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        `[auth:getAuthRoute] Missing/invalid env. URL=${rawUrl ? `"${rawUrl}"` : "unset"} KEY=${rawKey ? "set" : "unset"}`
      );
    }
    return { supabase: null, session: null, user: null, response };
  }

  // Narrow after guard so TS stops complaining
  const url: string = rawUrl;
  const key: string = rawKey;

  const cookieAdapter: CookieMethodsServer = {
    getAll() {
      return req.cookies.getAll();
    },
    setAll(cookiesToSet) {
      cookiesToSet.forEach(({ name, value, options }) => {
        response.cookies.set(name, value, options);
      });
    },
  };

  const supabase = createServerClient(url, key, { cookies: cookieAdapter });

  const { data, error } = await supabase.auth.getSession();
  if (error) return { supabase, session: null, user: null, response };

  const session = data.session ?? null;
  const user = session?.user ?? null;

  return { supabase, session, user, response };
}

export async function requireAuthRoute(
  req: NextRequest
): Promise<{
  supabase: SupabaseClient;
  session: Session;
  user: User;
  response: NextResponse;
}> {
  const { supabase, session, user, response } = await getAuthRoute(req);
  if (!supabase || !session || !user) throw new HttpError(401, "Unauthorized");
  return { supabase, session, user, response };
}

export function attachAuthCookies(from: NextResponse, to: NextResponse): NextResponse {
  for (const c of from.cookies.getAll()) {
    const { name, value, ...opts } = c as any;
    to.cookies.set(name, value, opts);
  }
  return to;
}

/* ================= Profiles (minimal) ================= */

export type Profile = {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
  preferences?: Record<string, unknown> | null;
};

export async function getProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, preferences")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    displayName: data.display_name ?? null,
    avatarUrl: data.avatar_url ?? null,
    preferences: data.preferences ?? null,
  };
}

export async function upsertProfile(
  supabase: SupabaseClient,
  userId: string,
  values: Partial<{
    displayName: string | null;
    avatarUrl: string | null;
    preferences: Record<string, unknown> | null;
  }>
): Promise<Profile | null> {
  const payload: Record<string, unknown> = {
    id: userId,
    ...(values.displayName !== undefined ? { display_name: values.displayName } : {}),
    ...(values.avatarUrl !== undefined ? { avatar_url: values.avatarUrl } : {}),
    ...(values.preferences !== undefined ? { preferences: values.preferences } : {}),
  };

  const { data, error } = await supabase
    .from("profiles")
    .upsert(payload, { onConflict: "id" })
    .select("id, display_name, avatar_url, preferences")
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    displayName: data.display_name ?? null,
    avatarUrl: data.avatar_url ?? null,
    preferences: data.preferences ?? null,
  };
}

/* ================= Service-role (cron/jobs) ================= */

export function createServiceClient(): SupabaseClient {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const rawKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!isHttpUrl(rawUrl) || !rawKey) {
    throw new Error(
      "Service client misconfigured: check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  // Narrow after guard
  const url: string = rawUrl;
  const key: string = rawKey;

  return createSupabaseJsClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

/* ================= Cron protection ================= */

const CRON_SECRET = process.env.CRON_SECRET || "";

export function verifyCronSecret(req: Request): boolean {
  if (!CRON_SECRET) return false;
  const bearer = req.headers.get("authorization") || req.headers.get("Authorization");
  if (bearer && /^Bearer\s+/i.test(bearer)) {
    const token = bearer.replace(/^Bearer\s+/i, "").trim();
    if (safeEq(token, CRON_SECRET)) return true;
  }
  const header = req.headers.get("x-cron-secret");
  if (header && safeEq(header.trim(), CRON_SECRET)) return true;
  return false;
}

export function assertCronSecret(req: Request): void {
  if (!verifyCronSecret(req)) {
    throw new HttpError(401, "Unauthorized (cron)");
  }
}

/* ================= Small helpers ================= */

function safeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

export function stripVersion(arxivId: string) {
  return arxivId.trim().replace(/^arxiv:/i, "").replace(/v\d+$/i, "");
}