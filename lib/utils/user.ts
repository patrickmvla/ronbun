import type { User as SupabaseUser } from "@supabase/supabase-js";
import type { User } from "@/types/auth";

/**
 * Extract user initials from name
 * @param name - Full name
 * @returns Two-letter initials
 */
export function getUserInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part.charAt(0))
    .filter((char) => char.match(/[a-zA-Z]/))
    .slice(0, 2)
    .join("")
    .toUpperCase() || "U";
}

/**
 * Map Supabase user to application user
 * @param supabaseUser - Supabase user object
 * @returns Normalized user object
 */
export function mapSupabaseUser(supabaseUser: SupabaseUser | null | undefined): User | null {
  if (!supabaseUser) return null;

  const meta = supabaseUser.user_metadata || {};
  
  // Try multiple fields for name (different OAuth providers use different fields)
  const name =
    meta.full_name ||
    meta.name ||
    meta.user_name ||
    meta.preferred_username ||
    supabaseUser.email?.split("@")[0] ||
    "User";

  // Try multiple fields for avatar
  const avatar =
    meta.avatar_url ||
    meta.picture ||
    meta.avatar ||
    undefined;

  return {
    id: supabaseUser.id,
    name: String(name),
    email: String(supabaseUser.email || ""),
    avatar,
  };
}

/**
 * Get user display name with fallback
 * @param user - User object
 * @returns Display name
 */
export function getUserDisplayName(user: User | null): string {
  if (!user) return "Account";
  return user.name || user.email.split("@")[0] || "User";
}