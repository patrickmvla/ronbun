// lib/watchlists-utils.ts
import type { WatchlistType } from "./types/watchlists";

export const LS_KEY = "ronbun:watchlists";

export function mockPreview(terms: string[], type: WatchlistType, cats: string[]) {
  if (!terms.length) return [] as Array<{
    id: string;
    title: string;
    authors: string[];
    category: string;
    time: string;
    arxivId: string;
  }>;

  const seed = terms.join("|").length + cats.join(",").length + type.length;

  const templates = [
    (t: string) => `${t}: An Empirical Study`,
    (t: string) => `Scaling ${t} with Simple Baselines`,
    (t: string) => `${t} Meets Transformers`,
    (t: string) => `On the Robustness of ${t}`,
    (t: string) => `A Survey of ${t}`,
  ];

  const authorsPool = [
    ["A. Gupta", "L. Wang"],
    ["J. Smith", "P. Kumar", "E. Chen"],
    ["C. Li", "R. Zhao"],
    ["N. Patel", "D. Brown"],
    ["Y. Tanaka", "H. Park"],
  ];

  const out: {
    id: string;
    title: string;
    authors: string[];
    category: string;
    time: string;
    arxivId: string;
  }[] = [];

  for (let i = 0; i < Math.min(5, terms.length + 2); i++) {
    const term = terms[i % terms.length];
    const tmpl = templates[(seed + i) % templates.length];
    const title = tmpl(term);
    const authors = authorsPool[(seed + i) % authorsPool.length];
    const category = cats[(seed + i) % cats.length] || "cs.AI";
    const hoursAgo = ((seed + i) % 96) + 1;
    const arxivSuffix = 10000 + ((seed + i) % 500);
    out.push({
      id: `pv-${i}`,
      title,
      authors,
      category,
      time: `${hoursAgo}h`,
      arxivId: `2501.${arxivSuffix}`,
    });
  }
  return out;
}