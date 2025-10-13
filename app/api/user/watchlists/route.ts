/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/user/watchlists/route.ts
import { NextResponse } from "next/server";
import { and, eq, desc } from "drizzle-orm";
import { db, schema } from "@/lib/drizzle/db";
import { requireAuth } from "@/lib/auth";
import { z } from "zod";
import { WatchlistSchema } from "@/lib/zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/*
  GET /api/user/watchlists? id=<uuid?>
    - If id provided: return one
    - Else: return all for user (newest first)
*/
export async function GET(req: Request) {
  try {
    const { user } = await requireAuth();
    const url = new URL(req.url);
    const id = url.searchParams.get("id");

    if (id) {
      const row = await db
        .select()
        .from(schema.watchlists)
        .where(and(eq(schema.watchlists.userId, user.id), eq(schema.watchlists.id, id)))
        .limit(1);

      if (!row.length) return json({ error: "Not found" }, 404);
      return json({ item: toClient(row[0]) });
    }

    const rows = await db
      .select()
      .from(schema.watchlists)
      .where(eq(schema.watchlists.userId, user.id))
      .orderBy(desc(schema.watchlists.createdAt));

    return json({ items: rows.map(toClient) });
  } catch (err: any) {
    return handleAuthOrError(err);
  }
}

/*
  POST /api/user/watchlists
  Body: { type, name, terms[], categories[] }
*/
export async function POST(req: Request) {
  try {
    const { user } = await requireAuth();
    const body = await req.json().catch(() => ({}));
    const parsed = CreateSchema.safeParse(body);
    if (!parsed.success) {
      return json({ error: "Invalid input", issues: parsed.error.flatten() }, 400);
    }
    const { type, name, terms, categories } = parsed.data;

    const [inserted] = await db
      .insert(schema.watchlists)
      .values({
        userId: user.id,
        type,
        name,
        terms: terms ?? [],
        categories: categories ?? [],
      })
      .returning();

    return json({ item: toClient(inserted) }, 201);
  } catch (err: any) {
    return handleAuthOrError(err);
  }
}

/*
  PATCH /api/user/watchlists
  Body: { id, ...fields } where fields ⊆ { type, name, terms, categories }
*/
export async function PATCH(req: Request) {
  try {
    const { user } = await requireAuth();
    const body = await req.json().catch(() => ({}));
    const parsed = UpdateSchema.safeParse(body);
    if (!parsed.success) {
      return json({ error: "Invalid input", issues: parsed.error.flatten() }, 400);
    }
    const { id, ...fields } = parsed.data;

    // Ensure the row belongs to the user
    const owner = await db
      .select({ id: schema.watchlists.id })
      .from(schema.watchlists)
      .where(and(eq(schema.watchlists.userId, user.id), eq(schema.watchlists.id, id)))
      .limit(1);
    if (!owner.length) return json({ error: "Not found" }, 404);

    const [updated] = await db
      .update(schema.watchlists)
      .set({
        ...(fields.type !== undefined ? { type: fields.type } : {}),
        ...(fields.name !== undefined ? { name: fields.name } : {}),
        ...(fields.terms !== undefined ? { terms: fields.terms } : {}),
        ...(fields.categories !== undefined ? { categories: fields.categories } : {}),
      })
      .where(eq(schema.watchlists.id, id))
      .returning();

    return json({ item: toClient(updated) });
  } catch (err: any) {
    return handleAuthOrError(err);
  }
}

/*
  DELETE /api/user/watchlists?id=<uuid>
  or Body: { id }
*/
export async function DELETE(req: Request) {
  try {
    const { user } = await requireAuth();

    const url = new URL(req.url);
    const idFromQuery = url.searchParams.get("id");
    const body = await safeJson(req).catch(() => null);
    const id = idFromQuery || (body && typeof body.id === "string" ? body.id : null);

    const parsed = IdSchema.safeParse({ id });
    if (!parsed.success) {
      return json({ error: "Missing or invalid id" }, 400);
    }

    // Ensure ownership
    const owner = await db
      .select({ id: schema.watchlists.id })
      .from(schema.watchlists)
      .where(and(eq(schema.watchlists.userId, user.id), eq(schema.watchlists.id, parsed.data.id)))
      .limit(1);
    if (!owner.length) return json({ error: "Not found" }, 404);

    await db.delete(schema.watchlists).where(eq(schema.watchlists.id, parsed.data.id));
    return json({ ok: true });
  } catch (err: any) {
    return handleAuthOrError(err);
  }
}

/* ========== Schemas & helpers ========== */

const CreateSchema = WatchlistSchema.omit({ id: true });
const UpdateSchema = WatchlistSchema.partial().extend({
  id: z.string().uuid(),
});
const IdSchema = z.object({ id: z.string().uuid() });

function toClient(row: typeof schema.watchlists.$inferSelect) {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    terms: row.terms ?? [],
    categories: row.categories ?? [],
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
  };
}

async function safeJson(req: Request): Promise<any> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

function json(body: unknown, status = 200, headers?: Record<string, string>) {
  return new NextResponse(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...(headers || {}) },
  });
}

function handleAuthOrError(err: any) {
  if (err && err.status === 401) return json({ error: "Unauthorized" }, 401);
  return json({ error: err?.message || "Server error" }, 500);
}