/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/pwc/[arxivId]/route.ts
import { NextResponse } from "next/server";
import { lookupPwcByArxiv, buildPwcSearchByTitle } from "@/lib/pwc";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    // Extract [arxivId] from URL path (last segment)
    const url = new URL(req.url);
    const segments = url.pathname.split("/").filter(Boolean);
    const raw = decodeURIComponent(segments[segments.length - 1] || "").trim();
    if (!raw) return json({ error: "Missing arXiv ID" }, 400);

    const baseId = stripVersion(raw);
    if (!/^\d{4}\.\d{5}$/.test(baseId)) {
      return json({ error: "Invalid arXiv base ID format" }, 400);
    }

    // Optional title (used only to provide a helpful fallback search URL)
    const title = url.searchParams.get("title") || undefined;

    const result = await lookupPwcByArxiv(baseId);

    // If not found and title provided, override searchUrl to a title search
    const payload =
      !result.found && title
        ? { ...result, searchUrl: buildPwcSearchByTitle(title) }
        : result;

    return json(payload, 200, {
      // Allow short CDN caching; PwC mappings don't change frequently
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=300",
    });
  } catch (err: any) {
    const msg = err?.message || "Failed to lookup Papers with Code";
    return json({ error: msg }, 500);
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