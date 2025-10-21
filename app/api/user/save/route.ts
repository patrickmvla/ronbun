/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/user/save/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/drizzle/db";
import { requireAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/*
  GET /api/user/save?status=saved&arxivId=2501.12345
    - Lists current user's saved/queued/reading/done items
    - Optional filter by status and/or arXiv ID
*/
export async function GET(req: Request) {
  try {
    const { user } = await requireAuth();
    const url = new URL(req.url);
    const status = asStatus(url.searchParams.get("status"));
    const arxivId = stripVersion(url.searchParams.get("arxivId") || "");

    // Join saves with papers for arxivIdBase + title
    const rows = await db
      .select({
        id: schema.userSaves.id,
        status: schema.userSaves.status,
        createdAt: schema.userSaves.createdAt,
        arxivId: schema.papers.arxivIdBase,
        title: schema.papers.title,
      })
      .from(schema.userSaves)
      .innerJoin(schema.papers, eq(schema.userSaves.paperId, schema.papers.id))
      .where(
        and(
          eq(schema.userSaves.userId, user.id),
          status ? eq(schema.userSaves.status, status) : undefined,
          arxivId ? eq(schema.papers.arxivIdBase, arxivId) : undefined
        )
      )
      .orderBy(desc(schema.userSaves.createdAt));

    return json({
      items: rows.map((r) => ({
        id: r.id,
        status: r.status,
        createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : null,
        arxivId: r.arxivId,
        title: r.title,
      })),
    });
  } catch (err: any) {
    return handleAuthOrError(err);
  }
}

/*
  POST /api/user/save
  Body: { arxivId: string, status?: 'queued'|'saved'|'reading'|'done', remove?: boolean }
    - Upsert or update a save for current user.
    - If remove=true → delete the save.
    - If status provided → set to that status.
    - If no status provided → cycle status (queued -> saved -> reading -> done -> queued),
      starting at 'queued' for new saves.
*/
export async function POST(req: Request) {
  try {
    const { user } = await requireAuth();
    const body = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return json({ error: "Invalid input", issues: parsed.error.flatten() }, 400);
    }

    const baseId = stripVersion(parsed.data.arxivId);
    if (!/^\d{4}\.\d{5}$/.test(baseId)) {
      return json({ error: "Invalid arXiv base ID format" }, 400);
    }

    // Find paper
    const paper = await db.query.papers.findFirst({
      where: (p, { eq }) => eq(p.arxivIdBase, baseId),
      columns: { id: true, arxivIdBase: true, title: true },
    });
    if (!paper) return json({ error: "Paper not found" }, 404);

    // If remove requested, delete save
    if (parsed.data.remove) {
      await db
        .delete(schema.userSaves)
        .where(and(eq(schema.userSaves.userId, user.id), eq(schema.userSaves.paperId, paper.id)));
      return json({ ok: true, removed: true });
    }

    // Determine next status
    const existing = await db
      .select({
        id: schema.userSaves.id,
        status: schema.userSaves.status,
        createdAt: schema.userSaves.createdAt,
      })
      .from(schema.userSaves)
      .where(and(eq(schema.userSaves.userId, user.id), eq(schema.userSaves.paperId, paper.id)))
      .limit(1)
      .then((rows) => rows[0] || null);

    const next =
      parsed.data.status ??
      (existing ? cycleStatus(existing.status) : ("queued" as SaveStatus));

    // Upsert save row
    const [row] = await db
      .insert(schema.userSaves)
      .values({
        userId: user.id,
        paperId: paper.id,
        status: next,
      })
      .onConflictDoUpdate({
        target: [schema.userSaves.userId, schema.userSaves.paperId],
        set: { status: next },
      })
      .returning({
        id: schema.userSaves.id,
        status: schema.userSaves.status,
        createdAt: schema.userSaves.createdAt,
      });

    return json({
      item: {
        id: row.id,
        status: row.status,
        createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
        arxivId: paper.arxivIdBase,
        title: paper.title,
      },
    });
  } catch (err: any) {
    return handleAuthOrError(err);
  }
}

/*
  DELETE /api/user/save?id=<uuid> | ?arxivId=2501.12345
  Body alternative: { id?: string, arxivId?: string }
*/
export async function DELETE(req: Request) {
  try {
    const { user } = await requireAuth();

    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    const arxivIn = url.searchParams.get("arxivId");

    let where:
      | ReturnType<typeof and>
      | undefined;

    if (id) {
      where = and(eq(schema.userSaves.userId, user.id), eq(schema.userSaves.id, id));
    } else if (arxivIn) {
      const baseId = stripVersion(arxivIn);
      const paper = await db.query.papers.findFirst({
        where: (p, { eq }) => eq(p.arxivIdBase, baseId),
        columns: { id: true },
      });
      if (!paper) return json({ error: "Paper not found" }, 404);
      where = and(eq(schema.userSaves.userId, user.id), eq(schema.userSaves.paperId, paper.id));
    } else {
      return json({ error: "Provide ?id= or ?arxivId=" }, 400);
    }

    await db.delete(schema.userSaves).where(where!);
    return json({ ok: true, removed: true });
  } catch (err: any) {
    return handleAuthOrError(err);
  }
}

/* ========== Schemas & helpers ========== */

type SaveStatus = "queued" | "saved" | "reading" | "done";

const BodySchema = z.object({
  arxivId: z.string().min(6),
  status: z.enum(["queued", "saved", "reading", "done"]).optional(),
  remove: z.boolean().optional(),
});

function cycleStatus(s: SaveStatus): SaveStatus {
  const order: SaveStatus[] = ["queued", "saved", "reading", "done"];
  const i = order.indexOf(s);
  return order[(i + 1) % order.length];
}

function asStatus(v: string | null): SaveStatus | null {
  if (!v) return null;
  return v === "queued" || v === "saved" || v === "reading" || v === "done" ? v : null;
}

function stripVersion(id: string) {
  return String(id || "").replace(/v\d+$/i, "");
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