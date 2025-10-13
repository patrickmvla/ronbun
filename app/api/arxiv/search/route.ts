// app/api/arxiv/search/route.ts
import { NextResponse } from "next/server";
import { searchArxiv, type ArxivSearchParams } from "@/lib/arxiv";

export const runtime = "nodejs"; // use Node for consistent env access
export const dynamic = "force-dynamic"; // avoid Next cache for a proxy-like route

type SortBy = ArxivSearchParams["sortBy"];
type SortOrder = ArxivSearchParams["sortOrder"];

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const sp = url.searchParams;

    const q = (sp.get("q") || "").trim();
    if (!q) {
      return json({ items: [], error: "Missing query (?q=...)" }, 400);
    }

    const start = clampInt(sp.get("start"), 0, 0, 10000); // arXiv offset
    const max = clampInt(sp.get("max"), 25, 1, 50); // keep polite page sizes
    const sortBy = asSortBy(sp.get("sortBy")) ?? "submittedDate";
    const sortOrder = asSortOrder(sp.get("sortOrder")) ?? "descending";

    const items = await searchArxiv({ q, start, max, sortBy, sortOrder });

    return json({ items }, 200, {
      // Cache hints for CDNs while keeping data relatively fresh
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
    });
  } catch (err: any) {
    const message = err?.message || "Failed to fetch arXiv results";
    return json({ items: [], error: message }, 500);
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

function clampInt(
  v: string | null,
  def: number,
  min: number,
  max: number
): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

function asSortBy(v: string | null): SortBy | null {
  if (v === "submittedDate" || v === "lastUpdatedDate" || v === "relevance")
    return v;
  return null;
}

function asSortOrder(v: string | null): SortOrder | null {
  if (v === "ascending" || v === "descending") return v;
  return null;
}
