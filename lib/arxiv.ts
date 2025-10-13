// lib/arxiv.ts
// Lightweight arXiv client: query builder, polite fetch with UA/backoff, Atom XML → JSON
import { XMLParser } from "fast-xml-parser";

export type ArxivItem = {
  arxivId: string; // may include version, e.g., 2501.12345v2
  title: string;
  summary: string;
  authors: string[];
  categories: string[];
  published: string; // ISO
  updated: string; // ISO
  pdfUrl: string | null;
};

export type ArxivSearchParams = {
  q: string; // arXiv AQS, e.g., cat:cs.LG AND all:transformer
  start?: number; // offset
  max?: number; // page size (max_results)
  sortBy?: "relevance" | "lastUpdatedDate" | "submittedDate";
  sortOrder?: "ascending" | "descending";
};

const ARXIV_ENDPOINT = "https://export.arxiv.org/api/query";

// Provide a descriptive UA; arXiv asks for one
const DEFAULT_UA =
  process.env.ARXIV_USER_AGENT ||
  `ronbun/0.1 (+${process.env.APP_URL ?? "https://example.com"}; mailto:contact@example.com)`;

/**
 * Build arXiv export API URL (uses search_query, max_results, start, sortBy, sortOrder)
 */
export function buildArxivUrl(params: ArxivSearchParams): string {
  const {
    q,
    start = 0,
    max = 25,
    sortBy = "submittedDate",
    sortOrder = "descending",
  } = params;

  const usp = new URLSearchParams();
  usp.set("search_query", q);
  usp.set("start", String(start));
  usp.set("max_results", String(max));
  usp.set("sortBy", sortBy);
  usp.set("sortOrder", sortOrder);

  return `${ARXIV_ENDPOINT}?${usp.toString()}`;
}

/**
 * Perform a polite fetch with retries/backoff and a proper User-Agent.
 */
export async function politeFetch(
  url: string,
  init: RequestInit & { retries?: number; retryDelayMs?: number } = {}
): Promise<Response> {
  const {
    retries = 3,
    retryDelayMs = 600,
    headers,
    ...rest
  } = init;

  const finalHeaders = new Headers(headers || {});
  if (!finalHeaders.has("User-Agent")) {
    finalHeaders.set("User-Agent", DEFAULT_UA);
  }
  if (!finalHeaders.has("Accept")) {
    finalHeaders.set("Accept", "application/atom+xml,application/xml;q=0.9,*/*;q=0.8");
  }

  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { ...rest, headers: finalHeaders });
      if (res.ok) return res;

      // Retry on 429/5xx
      if (res.status === 429 || (res.status >= 500 && res.status < 600)) {
        const delay =
          parseInt(res.headers.get("Retry-After") || "", 10) * 1000 ||
          retryDelayMs * Math.pow(2, attempt);
        await sleep(delay + jitter(150));
        continue;
      }

      // Non-retryable
      return res;
    } catch (err) {
      lastErr = err;
      if (attempt === retries) break;
      await sleep(retryDelayMs * Math.pow(2, attempt) + jitter(150));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("arXiv fetch failed");
}

/**
 * High-level: fetch arXiv items for a given query.
 */
export async function searchArxiv(params: ArxivSearchParams): Promise<ArxivItem[]> {
  const url = buildArxivUrl(params);
  const res = await politeFetch(url, { method: "GET" });
  if (!res.ok) {
    const msg = await safeText(res);
    throw new Error(msg || `arXiv error ${res.status}`);
  }
  const xml = await res.text();
  return parseArxivAtom(xml);
}

/**
 * Parse arXiv Atom XML to ArxivItem[]
 */
export function parseArxivAtom(xml: string): ArxivItem[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    textNodeName: "#text",
    trimValues: true,
    processEntities: true,
  });

  const root = parser.parse(xml);
  const feed = root?.feed;
  if (!feed) return [];

  const entries = toArray(feed.entry);
  return entries.map((entry: any) => {
    const idHref = String(entry?.id ?? "");
    const arxivId = extractArxivId(idHref) || ""; // may include version
    const title = normalizeText(String(entry?.title ?? ""));
    const summary = normalizeText(String(entry?.summary ?? ""));

    const authors = toArray(entry?.author)
      .map((a: any) => (typeof a?.name === "string" ? a.name.trim() : null))
      .filter(Boolean) as string[];

    // Categories from multiple <category term='...'> or arxiv:primary_category
    const catTerms = new Set<string>();
    const cats = toArray(entry?.category);
    for (const c of cats) {
      const term = typeof c?.["@_term"] === "string" ? c["@_term"] : null;
      if (term) catTerms.add(term);
    }
    const primary =
      typeof entry?.["arxiv:primary_category"]?.["@_term"] === "string"
        ? entry["arxiv:primary_category"]["@_term"]
        : null;
    if (primary) catTerms.add(primary);
    const categories = Array.from(catTerms);

    const published = toIso(entry?.published);
    const updated = toIso(entry?.updated ?? entry?.published);

    // PDF link
    const links = toArray(entry?.link);
    const pdfLink =
      links.find((l: any) => l?.["@_type"] === "application/pdf")?.["@_href"] ??
      (arxivId ? `https://arxiv.org/pdf/${stripVersion(arxivId)}.pdf` : null);

    return {
      arxivId,
      title,
      summary,
      authors,
      categories,
      published,
      updated,
      pdfUrl: pdfLink || null,
    } as ArxivItem;
  });
}

/* ========== Helpers ========== */

function toArray<T>(v: T | T[] | undefined | null): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function normalizeText(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function extractArxivId(idHref: string): string | null {
  // Typical id: https://arxiv.org/abs/2501.12345v2
  const m = idHref.match(/arxiv\.org\/abs\/([\w.\-]+)$/i);
  return m ? m[1] : null;
}

export function stripVersion(arxivId: string): string {
  return String(arxivId).replace(/v\d+$/i, "");
}

function toIso(v: unknown): string {
  try {
    const d = v ? new Date(String(v)) : new Date();
    return isFinite(d.getTime()) ? d.toISOString() : new Date().toISOString();
  } catch {
    return new Date().toISOString();
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function jitter(max = 100) {
  return Math.floor(Math.random() * max);
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}