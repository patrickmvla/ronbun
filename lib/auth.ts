// lib/auth.ts
// Supabase Auth helpers for server components and route handlers.
// - getAuth(): fetch session/user with cookies (Next 14/15 compatible)
// - requireAuth(): same but throws if unauthenticated
// - getProfile()/upsertProfile(): minimal profile helpers (RLS-friendly)
// - verifyCronSecret()/assertCronSecret(): protect cron endpoints with CRON_SECRET
//
// Notes:
// - These helpers rely on lib/supabase/server.ts (createClient) which builds a server-side client from cookies.
// - Works only in Node runtime (not Edge), since Supabase SSR client uses cookies().

import type { SupabaseClient, Session, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export type AuthResult = {
  supabase: SupabaseClient | null;
  session: Session | null;
  user: User | null;
};

/**
 * Return Supabase client, session, and user.
 * If Supabase is not configured (missing env), supabase = null and session/user = null.
 */
export async function getAuth(): Promise<AuthResult> {
  const supabase = await createClient();
  if (!supabase) {
    return { supabase: null, session: null, user: null };
  }
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    return { supabase, session: null, user: null };
  }
  const session = data.session ?? null;
  const user = session?.user ?? null;
  return { supabase, session, user };
}

/**
 * Require an authenticated user. Throws an Error(401) if not authenticated.
 * Use inside server components or route handlers.
 */
export async function requireAuth(): Promise<{ supabase: SupabaseClient; session: Session; user: User }> {
  const { supabase, session, user } = await getAuth();
  if (!supabase || !session || !user) {
    const err: any = new Error("Unauthorized");
    err.status = 401;
    throw err;
  }
  return { supabase, session, user };
}

/* ================= Profiles (minimal) ================= */

export type Profile = {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
  preferences?: Record<string, unknown> | null;
};

/**
 * Fetch the authenticated user's profile (RLS: user can read own row).
 */
export async function getProfile(supabase: SupabaseClient, userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, preferences")
    .eq("id", userId)
    .maybeSingle();

  if (error) return null;
  if (!data) return null;

  return {
    id: data.id,
    displayName: data.display_name ?? null,
    avatarUrl: data.avatar_url ?? null,
    preferences: data.preferences ?? null,
  };
}

/**
 * Upsert the authenticated user's profile. RLS should enforce id = auth.uid().
 */
export async function upsertProfile(
  supabase: SupabaseClient,
  userId: string,
  values: Partial<{ displayName: string | null; avatarUrl: string | null; preferences: Record<string, unknown> | null }>
): Promise<Profile | null> {
  const payload: any = {
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

/* ================= Cron protection ================= */

const CRON_SECRET = process.env.CRON_SECRET || "";

/**
 * Return true if request contains a valid cron secret.
 * Accepts either:
 * - Authorization: Bearer <CRON_SECRET>
 * - x-cron-secret: <CRON_SECRET>
 */
export function verifyCronSecret(req: Request): boolean {
  if (!CRON_SECRET) return false;
  const bearer = req.headers.get("authorization") || req.headers.get("Authorization");
  if (bearer && /^Bearer\s+/.test(bearer)) {
    const token = bearer.replace(/^Bearer\s+/i, "").trim();
    if (safeEq(token, CRON_SECRET)) return true;
  }
  const header = req.headers.get("x-cron-secret");
  if (header && safeEq(header.trim(), CRON_SECRET)) return true;
  return false;
}

/**
 * Throw Response(401) if cron secret missing/invalid.
 */
export function assertCronSecret(req: Request): void {
  if (!verifyCronSecret(req)) {
    const err: any = new Error("Unauthorized (cron)");
    err.status = 401;
    throw err;
  }
}

/* ================= Small helpers ================= */

function safeEq(a: string, b: string): boolean {
  // Constant-time-ish compare for short secrets (not cryptographically strong, but better than naive)
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}

export function stripVersion(arxivId: string) {
  return arxivId.replace(/v\d+$/i, "");
}