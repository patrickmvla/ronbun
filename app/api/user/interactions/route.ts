/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/user/interactions/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { db, schema } from "@/lib/drizzle/db";
import { requireAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const InteractionBodySchema = z.object({
  arxivId: z.string().min(6),
  type: z.enum([
    "abstract_expand",
    "pdf_click",
    "code_click",
    "arxiv_click",
    "tab_summary",
    "tab_explainer",
    "tab_reviewer",
    "tab_leaderboard",
    "share_click",
    "copy_bibtex",
  ]),
  meta: z.record(z.string(), z.unknown()).optional(),
});

// Batch schema for multiple interactions
const BatchInteractionSchema = z.object({
  interactions: z.array(InteractionBodySchema).min(1).max(50),
});

/**
 * POST /api/user/interactions
 * Record interaction events.
 * Body: { arxivId, type, meta? } OR { interactions: [...] }
 */
export async function POST(req: Request) {
  try {
    const { user } = await requireAuth();
    const body = await req.json().catch(() => ({}));

    // Support single or batch
    let interactions: z.infer<typeof InteractionBodySchema>[];

    if (body.interactions) {
      const parsed = BatchInteractionSchema.safeParse(body);
      if (!parsed.success) {
        return json({ error: "Invalid batch", issues: parsed.error.flatten() }, 400);
      }
      interactions = parsed.data.interactions;
    } else {
      const parsed = InteractionBodySchema.safeParse(body);
      if (!parsed.success) {
        return json({ error: "Invalid input", issues: parsed.error.flatten() }, 400);
      }
      interactions = [parsed.data];
    }

    // Resolve paper IDs
    const arxivIds = [...new Set(interactions.map((i) => stripVersion(i.arxivId)))];
    const papers = await db.query.papers.findMany({
      where: (p, { inArray }) => inArray(p.arxivIdBase, arxivIds),
      columns: { id: true, arxivIdBase: true },
    });
    const paperMap = new Map(papers.map((p) => [p.arxivIdBase, p.id]));

    // Build insert values
    const values = interactions
      .map((i) => {
        const paperId = paperMap.get(stripVersion(i.arxivId));
        if (!paperId) return null;
        return {
          userId: user.id,
          paperId,
          type: i.type as any,
          meta: i.meta,
        };
      })
      .filter(Boolean);

    if (values.length === 0) {
      return json({ error: "No valid papers found" }, 404);
    }

    await db.insert(schema.paperInteractions).values(values as any);

    return json({ ok: true, recorded: values.length }, 201);
  } catch (err: any) {
    return handleError(err);
  }
}

/* ========== Helpers ========== */

function stripVersion(id: string) {
  return String(id || "").replace(/v\d+$/i, "");
}

function json(body: unknown, status = 200) {
  return new NextResponse(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function handleError(err: any) {
  if (err?.status === 401) return json({ error: "Unauthorized" }, 401);
  console.error("[interactions]", err);
  return json({ error: err?.message || "Server error" }, 500);
}
