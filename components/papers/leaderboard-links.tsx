/* eslint-disable @typescript-eslint/no-explicit-any */
// components/papers/leaderboard-links.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ExternalLink,
  Github,
  Star,
  BarChart3,
  Trophy,
  RefreshCw,
  Info,
  Search,
} from "lucide-react";

type Status = "idle" | "loading" | "done" | "error";

export type PwcResult = {
  found: boolean;
  paperUrl?: string | null;
  repoUrl?: string | null;
  repoStars?: number | null;
  searchUrl?: string | null;
  sotaLinks?: Array<{ label: string; url: string }>;
};

type LeaderboardLinksProps = {
  arxivId: string; // base id (e.g., 2501.12345 or 2501.12345v2; we'll strip version)
  title?: string; // used for fallback title search
  hintBenchmarks?: string[]; // optional list from structured extraction to display alongside
  initial?: PwcResult; // server-provided mapping if available
  auto?: boolean; // auto-fetch if no initial
  className?: string;
};

export default function LeaderboardLinks({
  arxivId,
  title,
  hintBenchmarks,
  initial,
  auto = true,
  className,
}: LeaderboardLinksProps) {
  const baseId = stripVersion(arxivId);
  const [status, setStatus] = React.useState<Status>(initial ? "done" : "idle");
  const [data, setData] = React.useState<PwcResult | null>(initial ?? null);
  const [err, setErr] = React.useState<string>("");

  const arxivSearchUrl =
    data?.searchUrl ||
    `https://paperswithcode.com/search?q=${encodeURIComponent(`arXiv:${baseId}`)}`;
  const titleSearchUrl =
    title ? `https://paperswithcode.com/search?q=${encodeURIComponent(title)}` : null;

  const fetchPwc = React.useCallback(async () => {
    try {
      setStatus("loading");
      setErr("");
      const res = await fetch(`/api/pwc/${encodeURIComponent(baseId)}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        next: { revalidate: 0 },
      });
      if (!res.ok) {
        const msg = await safeText(res);
        throw new Error(msg || `Request failed (${res.status})`);
      }
      const json = (await res.json()) as PwcResult;
      setData(json);
      setStatus("done");
    } catch (e: any) {
      setStatus("error");
      setErr(e?.message || "Failed to fetch Papers with Code links.");
    }
  }, [baseId]);

  React.useEffect(() => {
    if (!initial && auto && status === "idle") {
      fetchPwc();
    }
  }, [auto, initial, status, fetchPwc]);

  return (
    <div className={["rounded-xl border bg-card p-4", className || ""].join(" ")}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-md bg-accent px-2 py-1 text-xs ring-1 ring-ring">
            <BarChart3 className="h-3.5 w-3.5 text-primary" />
            <span>Leaderboards</span>
          </div>
          {(data?.sotaLinks?.length ?? 0) > 0 ? (
            <Badge variant="secondary" className="border px-2 py-0.5 text-[10px]">
              <Trophy className="mr-1 h-3.5 w-3.5 text-primary" />
              SOTA pages linked
            </Badge>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={fetchPwc}
            disabled={status === "loading"}
          >
            <RefreshCw className={`h-4 w-4 ${status === "loading" ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="mt-2 inline-flex items-center gap-2 text-xs text-muted-foreground">
        <Info className="h-3.5 w-3.5" />
        Best‑effort links based on arXiv ID/title; may not be exhaustive.
      </div>

      <Separator className="my-3 opacity-50" />

      {/* Content states */}
      {status === "loading" ? <Skeleton /> : null}
      {status === "error" ? (
        <div className="inline-flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
          <Info className="mt-0.5 h-3.5 w-3.5" />
          <span>{err}</span>
        </div>
      ) : null}

      {status !== "loading" ? (
        <div className="grid gap-3 md:grid-cols-2">
          {/* Left: PwC searches + paper/repo links */}
          <div className="rounded-lg border bg-card/80 p-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Papers with Code
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {data?.paperUrl ? (
                <Button asChild size="sm" variant="secondary" className="h-8 gap-1.5">
                  <Link href={data.paperUrl} target="_blank" rel="noreferrer">
                    Paper on PwC
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              ) : (
                <Button asChild size="sm" variant="outline" className="h-8 gap-1.5">
                  <Link href={arxivSearchUrl} target="_blank" rel="noreferrer">
                    Search by arXiv ID
                    <Search className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              )}

              {titleSearchUrl ? (
                <Button asChild size="sm" variant="outline" className="h-8 gap-1.5">
                  <Link href={titleSearchUrl} target="_blank" rel="noreferrer">
                    Search by title
                    <Search className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              ) : null}

              {data?.repoUrl ? (
                <Button asChild size="sm" variant="outline" className="h-8 gap-1.5">
                  <Link href={data.repoUrl} target="_blank" rel="noreferrer">
                    Repo
                    <Github className="h-3.5 w-3.5" />
                    {typeof data.repoStars === "number" ? (
                      <span className="ml-1 inline-flex items-center gap-0.5 text-[11px] text-muted-foreground">
                        <Star className="h-3 w-3 fill-current text-primary" />
                        {formatCount(data.repoStars)}
                      </span>
                    ) : null}
                  </Link>
                </Button>
              ) : null}
            </div>
          </div>

          {/* Right: SOTA / Benchmarks */}
          <div className="rounded-lg border bg-card/80 p-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Mentioned benchmarks
            </div>
            <div className="mt-2 space-y-2 text-sm">
              {(data?.sotaLinks?.length ?? 0) > 0 ? (
                <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
                  {data!.sotaLinks!.map((s) => (
                    <li key={s.url} className="truncate">
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:underline"
                        title={s.url}
                      >
                        {s.label}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : hintBenchmarks?.length ? (
                <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
                  {hintBenchmarks.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              ) : (
                <span className="text-muted-foreground">Not stated</span>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ========== Skeleton ========== */

function Skeleton() {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="rounded-lg border bg-card/80 p-3">
          <div className="h-3 w-32 rounded bg-muted/60" />
          <div className="mt-2 flex flex-wrap gap-2">
            <div className="h-8 w-28 rounded-md border bg-muted/40" />
            <div className="h-8 w-28 rounded-md border bg-muted/30" />
            <div className="h-8 w-24 rounded-md border bg-muted/20" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ========== Utils ========== */

function stripVersion(id: string) {
  return id.replace(/v\d+$/i, "");
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

function formatCount(n: number) {
  if (n < 1000) return `${n}`;
  if (n < 10_000) return `${(n / 1000).toFixed(1)}k`;
  return `${Math.round(n / 1000)}k`;
}