/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/papers/[arxivId]/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { db, schema } from "@/lib/drizzle/db";
import { eq, asc, desc } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    // Extract [arxivId] from URL path (last segment)
    const { pathname } = req.nextUrl;
    const segments = pathname.split("/").filter(Boolean);
    const raw = decodeURIComponent(segments[segments.length - 1] || "").trim();
    if (!raw) return json({ error: "Missing arXiv ID" }, 400);

    const baseId = stripVersion(raw);

    // 1) Paper
    const paper = await db.query.papers.findFirst({
      where: (p, { eq }) => eq(p.arxivIdBase, baseId),
    });

    if (!paper) {
      return json({ error: "Not found" }, 404);
    }

    // 2) Authors (ordered)
    const authorRows = await db
      .select({
        name: schema.authors.name,
        position: schema.paperAuthors.position,
      })
      .from(schema.paperAuthors)
      .innerJoin(
        schema.authors,
        eq(schema.paperAuthors.authorId, schema.authors.id)
      )
      .where(eq(schema.paperAuthors.paperId, paper.id))
      .orderBy(asc(schema.paperAuthors.position));

    const authors = authorRows.map((r) => r.name);

    // 3) Enrichment (latest)
    const enrich = await db
      .select()
      .from(schema.paperEnrich)
      .where(eq(schema.paperEnrich.paperId, paper.id))
      .orderBy(desc(schema.paperEnrich.updatedAt))
      .limit(1)
      .then((rows) => rows[0] ?? null);

    // 4) Structured extraction (latest)
    const structured = await db
      .select()
      .from(schema.paperStructured)
      .where(eq(schema.paperStructured.paperId, paper.id))
      .orderBy(desc(schema.paperStructured.createdAt))
      .limit(1)
      .then((rows) => rows[0] ?? null);

    // 5) Scores (optional)
    const score = await db
      .select()
      .from(schema.paperScores)
      .where(eq(schema.paperScores.paperId, paper.id))
      .limit(1)
      .then((rows) => rows[0] ?? null);

    // 6) PwC links (latest; optional)
    const pwc = await db
      .select()
      .from(schema.pwcLinks)
      .where(eq(schema.pwcLinks.paperId, paper.id))
      .orderBy(desc(schema.pwcLinks.updatedAt))
      .limit(1)
      .then((rows) => rows[0] ?? null);

    // Build response payload
    const codeUrls = dedupe([
      ...(enrich?.codeUrls ?? []),
      ...(structured?.codeUrls ?? []),
    ]);

    const payload = {
      arxivId: paper.arxivIdBase,
      title: paper.title,
      abstract: paper.abstract,
      authors,
      categories: paper.categories ?? [],
      published: toIso(paper.publishedAt),
      updated: toIso(paper.updatedAt ?? paper.publishedAt),
      pdfUrl:
        paper.pdfUrl ??
        (paper.arxivIdBase
          ? `https://arxiv.org/pdf/${paper.arxivIdBase}.pdf`
          : null),

      // enrichment
      codeUrls,
      repoStars:
        enrich?.repoStars ??
        (typeof pwc?.repoStars === "number" ? pwc.repoStars : null),
      hasWeights: enrich?.hasWeights ?? false,

      // structured
      method: structured?.method ?? null,
      tasks: structured?.tasks ?? [],
      datasets: structured?.datasets ?? [],
      benchmarks: structured?.benchmarks ?? [],
      claimedSota: Array.isArray(structured?.claimedSota)
        ? structured!.claimedSota.length
        : 0,

      // optional extras for UI transparency
      score: score
        ? {
            global: Number(score.globalScore ?? 0),
            components: score.components ?? null,
          }
        : undefined,
      links: {
        abs:
          paper.absUrl ??
          (paper.arxivIdBase
            ? `https://arxiv.org/abs/${paper.arxivIdBase}`
            : null),
        pwc: pwc?.paperUrl ?? null,
        repo: enrich?.primaryRepo ?? pwc?.repoUrl ?? null,
      },
    };

    return json(payload, 200, {
      "Cache-Control": "public, s-maxage=120, stale-while-revalidate=60",
    });
  } catch (err: any) {
    const message = err?.message || "Failed to load paper";
    return json({ error: message }, 500);
  }
}

/* ========== Helpers ========== */

function json(body: unknown, status = 200, headers?: Record<string, string>) {
  return new NextResponse(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...(headers || {}),
    },
  });
}

function stripVersion(arxivId: string) {
  return String(arxivId).replace(/v\d+$/i, "");
}

function toIso(d: unknown): string {
  try {
    if (d instanceof Date)
      return isFinite(d.getTime()) ? d.toISOString() : new Date().toISOString();
    const x = new Date(String(d));
    return isFinite(x.getTime()) ? x.toISOString() : new Date().toISOString();
  } catch {
    return new Date().toISOString();
  }
}

function dedupe<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}