// lib/github.ts
// GitHub helpers: parse repo URLs and fetch repo metadata/readme via GitHub REST API v3.

export type RepoId = {
  owner: string;
  repo: string;
};

export type RepoMeta = RepoId & {
  fullName: string; // owner/repo
  url: string; // https://github.com/owner/repo
  description: string | null;
  homepage: string | null;
  defaultBranch: string | null;
  stars: number | null;
  forks: number | null;
  openIssues: number | null;
  topics: string[];
  license: string | null; // SPDX id if available (e.g., MIT)
  archived: boolean;
  lastPushAt: string | null; // ISO
};

export type RepoReadme = {
  path: string; // README filename/path
  sha: string;
  text: string; // decoded UTF-8
};

const GH_API = "https://api.github.com";
const GH_WEB = "https://github.com";
const GH_TOKEN = process.env.GITHUB_TOKEN || "";
const APP_UA =
  process.env.ARXIV_USER_AGENT ||
  `ronbun/0.1 (+${
    process.env.APP_URL ?? "https://example.com"
  }; mailto:contact@example.com)`;

/**
 * Parse a GitHub repository URL or shorthand into { owner, repo }.
 * Supports:
 * - https://github.com/owner/repo
 * - https://github.com/owner/repo/
 * - https://github.com/owner/repo/tree/<branch>/...
 * - https://github.com/owner/repo/blob/<branch>/path
 * - git@github.com:owner/repo.git
 * - http(s)://www.github.com/owner/repo
 * - github:owner/repo, gh:owner/repo
 */
export function parseGitHubRepo(input: string): RepoId | null {
  if (!input) return null;
  const s = String(input).trim();

  // Shorthand
  const shorthand = s.match(
    /^(?:github:|gh:)?([a-z0-9_.-]+)\/([a-z0-9_.-]+)(?:\.git)?$/i
  );
  if (shorthand) return { owner: shorthand[1], repo: shorthand[2] };

  // SSH
  const ssh = s.match(
    /^git@github\.com:([a-z0-9_.-]+)\/([a-z0-9_.-]+)(?:\.git)?$/i
  );
  if (ssh) return { owner: ssh[1], repo: ssh[2] };

  // HTTPS
  let url: URL | null = null;
  try {
    url = new URL(s);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./i, "").toLowerCase();
  if (!/^(?:github\.com)$/.test(host)) return null;

  const parts = url.pathname.replace(/^\/+|\/+$/g, "").split("/");
  // Expected at minimum: /owner/repo
  if (parts.length < 2) return null;
  const owner = parts[0];
  const repo = parts[1].replace(/\.git$/i, "");
  if (!owner || !repo) return null;

  return { owner, repo };
}

/**
 * Return a canonical HTTPS URL for a repo id.
 */
export function repoUrl(id: RepoId): string {
  return `${GH_WEB}/${id.owner}/${id.repo}`;
}

/**
 * Fetch repository metadata (stars, license, topics, etc.).
 */
export async function fetchRepoMeta(
  owner: string,
  repo: string
): Promise<RepoMeta> {
  const url = `${GH_API}/repos/${encodeURIComponent(
    owner
  )}/${encodeURIComponent(repo)}`;
  const data = await fetchJson<any>(url);

  const topics: string[] = Array.isArray(data?.topics)
    ? data.topics.map(String)
    : [];

  const license: string | null =
    typeof data?.license?.spdx_id === "string" &&
    data.license.spdx_id !== "NOASSERTION"
      ? data.license.spdx_id
      : null;

  return {
    owner,
    repo,
    fullName: String(data?.full_name ?? `${owner}/${repo}`),
    url: String(data?.html_url ?? repoUrl({ owner, repo })),
    description: data?.description ?? null,
    homepage: data?.homepage ?? null,
    defaultBranch: data?.default_branch ?? null,
    stars: toNumOrNull(data?.stargazers_count),
    forks: toNumOrNull(data?.forks_count),
    openIssues: toNumOrNull(data?.open_issues_count),
    topics,
    license,
    archived: Boolean(data?.archived),
    lastPushAt: toIsoOrNull(data?.pushed_at),
  };
}

/**
 * Fetch README text via API. Optionally provide a ref (branch/tag/commit SHA).
 */
export async function fetchRepoReadme(
  owner: string,
  repo: string,
  ref?: string
): Promise<RepoReadme | null> {
  const url = new URL(
    `${GH_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(
      repo
    )}/readme`
  );
  if (ref) url.searchParams.set("ref", ref);

  const res = await fetch(url.toString(), {
    headers: ghHeaders({ Accept: "application/vnd.github+json" }),
    cache: "no-store",
  });

  if (res.status === 404) return null;
  if (!res.ok) {
    const msg = await safeText(res);
    throw new Error(msg || `GitHub README error ${res.status}`);
  }

  const json: any = await res.json();
  const content = String(json?.content ?? "");
  const sha = String(json?.sha ?? "");
  const path = String(json?.path ?? "README.md");

  if (!content) return null;

  const text = decodeBase64(content);
  return { path, sha, text };
}

/**
 * Try to infer a primary repo from a list of URLs, return its meta and optional README.
 */
export async function getRepoBundleFromUrls(
  urls: string[],
  ref?: string
): Promise<(RepoMeta & { readme?: RepoReadme | null }) | null> {
  if (!Array.isArray(urls) || urls.length === 0) return null;
  const unique = Array.from(new Set(urls.map((u) => u.trim()).filter(Boolean)));
  for (const u of unique) {
    const id = parseGitHubRepo(u);
    if (!id) continue;
    try {
      const meta = await fetchRepoMeta(id.owner, id.repo);
      const readme = await fetchRepoReadme(id.owner, id.repo, ref).catch(
        () => null
      );
      return { ...meta, readme };
    } catch {
      // Try next candidate
      continue;
    }
  }
  return null;
}

/* ========== Internal helpers ========== */

function ghHeaders(extra?: Record<string, string>) {
  const h = new Headers(extra || {});
  if (!h.has("Accept")) h.set("Accept", "application/vnd.github+json");
  if (!h.has("User-Agent")) h.set("User-Agent", APP_UA);
  if (GH_TOKEN && !h.has("Authorization"))
    h.set("Authorization", `Bearer ${GH_TOKEN}`);
  return h;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = ghHeaders(
    init?.headers as Record<string, string> | undefined
  );
  const res = await fetch(url, { ...init, headers, cache: "no-store" });
  if (!res.ok) {
    const msg = await safeText(res);
    throw new Error(msg || `GitHub error ${res.status}`);
  }
  return (await res.json()) as T;
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

function toNumOrNull(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toIsoOrNull(v: unknown): string | null {
  if (!v) return null;
  const d = new Date(String(v));
  return isFinite(d.getTime()) ? d.toISOString() : null;
}

function decodeBase64(b64: string): string {
  // GitHub API returns base64 with newlines; strip them
  const clean = b64.replace(/\s+/g, "");
  if (typeof atob === "function") {
    try {
      // atob yields binary string; decode to UTF-8
      const bin = atob(clean);
      // Convert binary string to UTF-8
      const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
      try {
        return new TextDecoder("utf-8").decode(bytes);
      } catch {
        // Fallback: naive decode
        return Array.from(bytes)
          .map((b) => String.fromCharCode(b))
          .join("");
      }
    } catch {
      // fall through to Buffer
    }
  }
  // Node fallback

  return typeof Buffer !== "undefined"
    ? Buffer.from(clean, "base64").toString("utf-8")
    : "";
}
