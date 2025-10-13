// lib/pwc.ts
// Papers with Code client: lookup by arXiv ID, paper/repo mapping, and SOTA links.
// Uses keyless access by default. If you have a token, set PWC_API_TOKEN to increase reliability.

export type PwcLookup = {
  found: boolean;
  paperUrl?: string | null;
  repoUrl?: string | null;
  repoStars?: number | null;
  searchUrl: string; // fallback search by arXiv ID
  sotaLinks: Array<{ label: string; url: string }>;
};

const PWC_API = "https://paperswithcode.com/api/v1";
const PWC_WEB = "https://paperswithcode.com";

const PWC_TOKEN = process.env.PWC_API_TOKEN || "";
const APP_UA =
  process.env.ARXIV_USER_AGENT ||
  `ronbun/0.1 (+${process.env.APP_URL ?? "https://example.com"}; mailto:contact@example.com)`;

/**
 * Main high-level lookup:
 * - Find PwC paper by arXiv base ID
 * - Pick the top (most-starred) repo if any
 * - Build SOTA links from results (task/dataset slugs)
 */
export async function lookupPwcByArxiv(arxivId: string): Promise<PwcLookup> {
  const baseId = stripVersion(arxivId);
  const searchUrl = buildPwcSearchByArxiv(baseId);

  const paper = await findPaperByArxivId(baseId);
  if (!paper) {
    return { found: false, paperUrl: null, repoUrl: null, repoStars: null, searchUrl, sotaLinks: [] };
  }

  const paperUrl = absolutizeUrl(paper.url);
  const [repo, sotaLinks] = await Promise.all([
    findTopRepoForPaper(paper.id),
    findSotaLinksForPaper(paper.id),
  ]);

  return {
    found: true,
    paperUrl,
    repoUrl: repo?.url ?? null,
    repoStars: repo?.stars ?? null,
    searchUrl,
    sotaLinks,
  };
}

/* ========== Low-level API calls ========== */

type PwcListResp<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

type PwcPaper = {
  id: string;
  arxiv_id: string | null;
  title: string;
  url: string; // relative path (e.g., "/paper/xyz")
};

type PwcRepo = {
  url: string;
  stars?: number | null;
};

type PwcResult = {
  task?: { name?: string; slug?: string };
  dataset?: { name?: string; slug?: string };
  // metric, score, etc. omitted
};

async function findPaperByArxivId(arxivIdBase: string): Promise<PwcPaper | null> {
  const url = `${PWC_API}/papers/?arxiv_id=${encodeURIComponent(arxivIdBase)}`;
  const list = await fetchJson<PwcListResp<PwcPaper>>(url);
  if (!list || !Array.isArray(list.results) || list.results.length === 0) return null;
  // Prefer exact arXiv ID match if multiple
  const exact = list.results.find((p) => normalize(p.arxiv_id) === normalize(arxivIdBase));
  return exact ?? list.results[0];
}

async function findTopRepoForPaper(paperId: string): Promise<PwcRepo | null> {
  const url = `${PWC_API}/papers/${encodeURIComponent(paperId)}/repositories/`;
  const list = await fetchJson<PwcListResp<PwcRepo>>(url).catch(() => null);
  if (!list || !Array.isArray(list.results) || list.results.length === 0) return null;
  // Pick by highest stars (fallback to first)
  const sorted = [...list.results].sort((a, b) => (toNum(b.stars) - toNum(a.stars)));
  return sorted[0] ?? null;
}

async function findSotaLinksForPaper(paperId: string): Promise<Array<{ label: string; url: string }>> {
  // Try results endpoint
  const url = `${PWC_API}/papers/${encodeURIComponent(paperId)}/results/`;
  const list = await fetchJson<PwcListResp<PwcResult>>(url).catch(() => null);
  if (!list || !Array.isArray(list.results) || list.results.length === 0) return [];

  const links: Array<{ label: string; url: string }> = [];
  const seen = new Set<string>();

  for (const r of list.results) {
    const taskName = r.task?.name?.trim();
    const dsName = r.dataset?.name?.trim();
    const taskSlug = r.task?.slug?.trim();
    const dsSlug = r.dataset?.slug?.trim();
    if (!taskName || !dsName) continue;

    const label = `${taskName} — ${dsName}`;
    const key = `${taskName}|||${dsName}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const url =
      taskSlug && dsSlug
        ? `${PWC_WEB}/sota/${encodeURIComponent(taskSlug)}-on-${encodeURIComponent(dsSlug)}`
        : `${PWC_WEB}/search?q=${encodeURIComponent(`${taskName} ${dsName}`)}`;

    links.push({ label, url });
    if (links.length >= 8) break; // cap to keep UI tidy
  }

  return links;
}

/* ========== Fetch helper ========== */

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers || {});
  headers.set("Accept", "application/json");
  if (!headers.has("User-Agent")) headers.set("User-Agent", APP_UA);
  if (PWC_TOKEN && !headers.has("Authorization")) headers.set("Authorization", `Token ${PWC_TOKEN}`);

  const res = await fetch(url, { ...init, headers, cache: "no-store" });
  if (!res.ok) {
    const msg = await safeText(res);
    throw new Error(msg || `PwC error ${res.status}`);
  }
  return (await res.json()) as T;
}

/* ========== Utils ========== */

function stripVersion(id: string) {
  return String(id).replace(/v\d+$/i, "");
}

function normalize(v: string | null | undefined) {
  return (v ?? "").trim().toLowerCase();
}

function toNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function absolutizeUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${PWC_WEB}${path.startsWith("/") ? "" : "/"}${path}`;
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

/* ========== Convenience builders ========== */

export function buildPwcSearchByArxiv(arxivIdBase: string) {
  return `${PWC_WEB}/search?q=${encodeURIComponent(`arXiv:${stripVersion(arxivIdBase)}`)}`;
}

export function buildPwcSearchByTitle(title: string) {
  return `${PWC_WEB}/search?q=${encodeURIComponent(title)}`;
}