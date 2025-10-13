// lib/compare-utils.ts
import type { CompareItem } from "@/types/compare";

export function parseInputToBaseId(input?: string | null): string | null {
  if (!input) return null;
  const s = input.trim();
  if (!s) return null;
  const urlMatch = s.match(/arxiv\.org\/(?:abs|pdf)\/(\d{4}\.\d{5})(?:v\d+)?/i);
  const rawMatch = s.match(/^(\d{4}\.\d{5})(?:v\d+)?$/);
  const id = urlMatch?.[1] || rawMatch?.[1];
  return id || null;
}

export function stripVersion(arxivId: string) {
  return String(arxivId).replace(/v\d+$/i, "");
}

export function relativeTime(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - d);
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d2 = Math.floor(h / 24);
  if (d2 < 7) return `${d2}d ago`;
  const w = Math.floor(d2 / 7);
  return `${w}w ago`;
}

export function formatFullDate(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

export function quickSummary(p: CompareItem) {
  const method = p.method || "the proposed approach";
  const tasks = (p.tasks?.length ?? 0) > 0 ? p.tasks!.join(", ") : "Not stated";
  const bench = (p.benchmarks?.length ?? 0) > 0 ? p.benchmarks!.join(", ") : "Not stated";

  return {
    oneLiner: `Introduces ${method} for ${tasks} and reports results on ${bench}.`,
    bullets: [
      `Method: ${method}`,
      `Tasks/datasets: ${tasks}${(p.datasets?.length ?? 0) ? ` (${p.datasets!.join(", ")})` : ""}`,
      `Benchmarks: ${bench}`,
      `Code: ${p.codeUrls?.length ? "Link provided" : "Not stated"}`,
      `SOTA claim: ${(p.claimedSota ?? 0) > 0 ? "Claimed" : "Not stated"}`,
    ],
  };
}