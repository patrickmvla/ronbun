/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/user/profile/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { db, schema } from "@/lib/drizzle/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PreferencesSchema = z.object({
  categories: z.array(z.string()).min(1, "Select at least one category"),
  defaultView: z.enum(["today", "week", "for-you"]).optional(),
  explainerLevel: z.enum(["eli5", "student", "expert"]).optional(),
  digestEnabled: z.boolean().optional(),
  digestDay: z.enum(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]).optional(),
  digestTime: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM format").optional(),
  density: z.enum(["comfortable", "compact"]).optional(),
  timezone: z.string().optional(),
});

const UpdateProfileSchema = z.object({
  displayName: z.string().min(2, "Too short").max(64, "Too long").optional(),
  preferences: PreferencesSchema.optional(),
});

const DeleteAccountSchema = z.object({
  confirm: z.literal(true, {
    message: "You must confirm account deletion",
  }),
});

/**
 * GET /api/user/profile
 * Fetch current user profile
 */
export async function GET() {
  try {
    const { user } = await requireAuth();

    const profile = await db.query.profiles.findFirst({
      where: eq(schema.profiles.id, user.id),
    });

    return json({
      profile: profile
        ? {
            id: profile.id,
            displayName: profile.displayName,
            avatarUrl: profile.avatarUrl,
            preferences: profile.preferences || {},
            createdAt: profile.createdAt,
            updatedAt: profile.updatedAt,
          }
        : null,
    });
  } catch (err: any) {
    return handleAuthOrError(err);
  }
}

/**
 * PATCH /api/user/profile
 * Update user profile and preferences
 */
export async function PATCH(req: Request) {
  try {
    const { user } = await requireAuth();
    const body = await req.json().catch(() => ({}));

    const parsed = UpdateProfileSchema.safeParse(body);
    if (!parsed.success) {
      return json(
        { error: "Invalid input", issues: parsed.error.flatten() },
        400
      );
    }

    const { displayName, preferences } = parsed.data;

    // Build update payload
    const updates: any = {};
    if (displayName !== undefined) {
      updates.displayName = displayName;
    }
    if (preferences !== undefined) {
      // Merge with existing preferences
      const existing = await db.query.profiles.findFirst({
        where: eq(schema.profiles.id, user.id),
        columns: { preferences: true },
      });

      updates.preferences = {
        ...(existing?.preferences || {}),
        ...preferences,
      };
    }
    updates.updatedAt = new Date();

    // Upsert profile
    const [updated] = await db
      .insert(schema.profiles)
      .values({
        id: user.id,
        ...updates,
      })
      .onConflictDoUpdate({
        target: schema.profiles.id,
        set: updates,
      })
      .returning();

    return json({
      profile: {
        id: updated.id,
        displayName: updated.displayName,
        avatarUrl: updated.avatarUrl,
        preferences: updated.preferences || {},
        updatedAt: updated.updatedAt,
      },
    });
  } catch (err: any) {
    return handleAuthOrError(err);
  }
}

/**
 * DELETE /api/user/profile
 * Delete user account and all associated data
 */
export async function DELETE(req: Request) {
  try {
    const { user } = await requireAuth();
    const body = await req.json().catch(() => ({}));

    const parsed = DeleteAccountSchema.safeParse(body);
    if (!parsed.success) {
      return json(
        { error: "Must confirm deletion", issues: parsed.error.flatten() },
        400
      );
    }

    // Delete in order (cascade handled by FK constraints)
    // 1. User watchlists
    await db.delete(schema.watchlists).where(eq(schema.watchlists.userId, user.id));

    // 2. User saves
    await db.delete(schema.userSaves).where(eq(schema.userSaves.userId, user.id));

    // 3. Profile
    await db.delete(schema.profiles).where(eq(schema.profiles.id, user.id));

    // 4. Delete Supabase auth user (requires service role key)
    // Note: This will fail if using anon key. Need admin endpoint or service role.
    // For now, we'll just delete app data and leave auth.users orphaned
    // TODO: Add admin endpoint or use Supabase service role

    return json({
      ok: true,
      message: "Account data deleted. Please contact support to complete auth deletion.",
    });
  } catch (err: any) {
    return handleAuthOrError(err);
  }
}

/* ========== Helpers ========== */

function json(body: unknown, status = 200) {
  return new NextResponse(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function handleAuthOrError(err: any) {
  if (err && err.status === 401) {
    return json({ error: "Unauthorized" }, 401);
  }
  return json({ error: err?.message || "Server error" }, 500);
}
