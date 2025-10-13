// app/api/repos/meta/route.ts
import { NextResponse } from "next/server";
import {
  parseGitHubRepo,
  fetchRepoMeta,
  fetchRepoReadme,
  type RepoMeta,
  type RepoReadme,
} from "@/lib/github";

export const runtime = "edge";
export const dynamic = "force-dynamic";

type RepoItem =
  | {
      input: string;
      ok: true;
      owner: string;
      repo: string;
      meta: RepoMeta;
      readme?: RepoReadme | null; // only present if includeReadme=true
    }
  | {
      input: string;
      ok: false;
      error: string;
    };

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const sp = url.searchParams;

    // Accept ?url=... repeated, or shorthand owner/repo via ?owner=&repo=
    const inputs = new Set<string>(sp.getAll("url").map((s) => s.trim()).filter(Boolean));
    const owner = sp.get("owner")?.trim();
    const repo = sp.get("repo")?.trim();
    if (owner && repo) inputs.add(`${owner}/${repo}`);

    if (inputs.size === 0) {
      return json({ error: "Provide ?url=<github-repo-url> (repeatable) or ?owner=&repo=" }, 400);
    }

    const includeReadme = (sp.get("readme") || "").toLowerCase() === "1" || sp.get("readme") === "true";
    const ref = sp.get("ref") || undefined;

    const items = await resolveRepos(Array.from(inputs), { includeReadme, ref });
    return json(
      { items },
      200,
      { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=120" }
    );
  } catch (err: any) {
    return json({ error: err?.message || "Failed to fetch repo metadata" }, 500);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const urlsIn: unknown = body?.urls ?? body?.url ?? [];
    const ref: string | undefined = body?.ref || undefined;
    const includeReadme: boolean = Boolean(body?.readme ?? body?.includeReadme);

    const inputs: string[] = normalizeInputs(urlsIn);
    if (inputs.length === 0) {
      return json({ error: "Body must include { url: string } or { urls: string[] }" }, 400);
    }

    const items = await resolveRepos(inputs, { includeReadme, ref });
    return json({ items }, 200);
  } catch (err: any) {
    return json({ error: err?.message || "Failed to fetch repo metadata" }, 500);
  }
}

/* ========== Core ========== */

async function resolveRepos(
  inputs: string[],
  opts: { includeReadme: boolean; ref?: string }
): Promise<RepoItem[]> {
  const unique = Array.from(new Set(inputs.map((s) => s.trim()).filter(Boolean)));

  const results = await Promise.all(
    unique.map(async (input): Promise<RepoItem> => {
      const id = parseGitHubRepo(input);
      if (!id) {
        return { input, ok: false, error: "Invalid GitHub repo URL or shorthand (owner/repo)" };
      }
      try {
        const meta = await fetchRepoMeta(id.owner, id.repo);
        let readme: RepoReadme | null | undefined = undefined;
        if (opts.includeReadme) {
          readme = await fetchRepoReadme(id.owner, id.repo, opts.ref).catch(() => null);
        }
        return { input, ok: true, owner: id.owner, repo: id.repo, meta, ...(opts.includeReadme ? { readme } : {}) };
      } catch (e: any) {
        return { input, ok: false, error: e?.message || "Failed to fetch metadata" };
      }
    })
  );

  return results;
}

/* ========== Helpers ========== */

function normalizeInputs(v: unknown): string[] {
  if (typeof v === "string") return [v];
  if (Array.isArray(v)) return v.map(String);
  return [];
}

function json(body: unknown, status = 200, headers?: Record<string, string>) {
  return new NextResponse(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...(headers || {}) },
  });
}