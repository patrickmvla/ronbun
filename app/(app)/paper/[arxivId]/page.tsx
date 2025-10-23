/* eslint-disable @typescript-eslint/no-explicit-any */
// app/(app)/paper/[arxivId]/page.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ExternalLink, FileText, Github, Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import PaperBadges from "@/components/papers/paper-badges";
import SummaryStream from "@/components/papers/summary-stream";
import ExplainerPanel from "@/components/papers/explainer-panel";
import ReviewPanel from "@/components/papers/review-panel";
import LeaderboardLinks from "@/components/papers/leaderboard-links";

/* ========== Types from /api/papers/[arxivId] ========== */
type ApiPaper = {
  arxivId: string;
  title: string;
  abstract: string;
  authors: string[];
  categories: string[];
  published: string; // ISO
  updated: string; // ISO
  pdfUrl: string | null;
  // Enrichment
  codeUrls?: string[];
  repoStars?: number | null;
  hasWeights?: boolean | null;
  // Structured
  method?: string | null;
  tasks?: string[];
  datasets?: string[];
  benchmarks?: string[];
  claimedSota?: number; // count of claims
  // Optional extras
  links?: {
    abs?: string | null;
    pwc?: string | null;
    repo?: string | null;
  };
};

export const dynamic = "force-dynamic";

/* ========== Page ========== */
export default function PaperPage() {
  const params = useParams();
  const raw = String(params?.arxivId || "");
  const baseId = stripVersion(decodeURIComponent(raw));

  const [paper, setPaper] = React.useState<ApiPaper | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch(`/api/papers/${encodeURIComponent(baseId)}`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
        });
        if (!res.ok) {
          const msg = await safeText(res);
          throw new Error(msg || `Failed to load paper (${res.status})`);
        }
        const data = (await res.json()) as ApiPaper;
        if (!cancelled) setPaper(data);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || "Failed to load paper");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (baseId) load();
    return () => {
      cancelled = true;
    };
  }, [baseId]);

  // Derived links with graceful fallbacks
  const absUrl =
    paper?.links?.abs ?? (baseId ? `https://arxiv.org/abs/${baseId}` : "#");
  const pdfUrl =
    paper?.pdfUrl ?? (baseId ? `https://arxiv.org/pdf/${baseId}.pdf` : "#");
  const codeUrl = paper?.links?.repo || paper?.codeUrls?.[0] || null;

  // Loading / error states
  if (loading) {
    return (
      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="h-8 px-2"
              disabled
            >
              <span className="inline-flex items-center gap-1.5">
                <ArrowLeft className="mr-1 h-4 w-4" />
                Back to Feed
              </span>
            </Button>
            <span className="text-xs text-muted-foreground">
              arXiv:{baseId}
            </span>
          </div>
        </div>
        <header className="rounded-xl border bg-card p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">Loading…</Badge>
            <span className="text-[11px] text-muted-foreground">Loading…</span>
          </div>
          <div className="mt-2 h-6 w-3/4 rounded bg-muted/40" />
          <div className="mt-2 h-4 w-1/2 rounded bg-muted/30" />
          <div className="mt-2">
            <div className="h-6 w-40 rounded bg-muted/30" />
          </div>
        </header>
        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_320px]">
          <section className="min-w-0">
            <div className="h-10 rounded bg-muted/30" />
            <div className="mt-3 h-24 rounded bg-muted/20" />
          </section>
          <aside className="space-y-3">
            <div className="rounded-xl border bg-card p-4">
              <div className="h-4 w-24 rounded bg-muted/30" />
              <div className="mt-3 h-20 rounded bg-muted/20" />
            </div>
          </aside>
        </div>
      </div>
    );
  }

  if (err || !paper) {
    return (
      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-3 flex items-center justify-between">
          <Button asChild variant="ghost" size="sm" className="h-8 px-2">
            <Link href="/feed">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back to Feed
            </Link>
          </Button>
          <span className="text-xs text-muted-foreground">arXiv:{baseId}</span>
        </div>
        <div className="rounded-xl border bg-card p-6">
          <p className="text-sm">
            {err || "Paper not found."}{" "}
            <Link href="/feed" className="text-primary underline">
              Go back to feed
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl">
      {/* Header: back + actions */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="h-8 px-2">
            <Link href="/feed">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back to Feed
            </Link>
          </Button>
          <span className="text-xs text-muted-foreground">arXiv:{baseId}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm" className="h-8 gap-1.5">
            <Link href={absUrl} target="_blank" rel="noreferrer">
              arXiv
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="h-8 gap-1.5">
            <Link href={pdfUrl} target="_blank" rel="noreferrer">
              PDF
              <FileText className="h-3.5 w-3.5" />
            </Link>
          </Button>
          {codeUrl ? (
            <Button asChild variant="outline" size="sm" className="h-8 gap-1.5">
              <Link href={codeUrl} target="_blank" rel="noreferrer">
                Code
                <Github className="h-3.5 w-3.5" />
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      {/* Title block */}
      <header className="rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{paper.categories?.[0] || "cs.AI"}</Badge>
          <span className="text-[11px] text-muted-foreground">
            {formatFullDate(paper.published)} • {relativeTime(paper.published)}
          </span>
        </div>
        <h1 className="mt-2 text-xl font-semibold leading-tight tracking-tight">
          {paper.title}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {paper.authors?.join(", ")}
        </p>

        {/* Badges (reused) */}
        <PaperBadges paper={paper as any} className="mt-2" />
      </header>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* Left: main tabs */}
        <section className="min-w-0">
          <Tabs defaultValue="summary" className="w-full">
            <TabsList className="grid grid-cols-4">
              <TabsTrigger value="summary">Summary</TabsTrigger>
              <TabsTrigger value="explainers">Explainers</TabsTrigger>
              <TabsTrigger value="reviewer">Reviewer</TabsTrigger>
              <TabsTrigger value="leaderboards">Leaderboards</TabsTrigger>
            </TabsList>

            {/* Summary (streaming) */}
            <TabsContent value="summary" className="mt-3">
              <SummaryStream title={paper.title} abstract={paper.abstract} />

              {/* Structured fields */}
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <FieldCard
                  label="Method"
                  value={paper.method || "Not stated"}
                />
                <FieldCard
                  label="Tasks"
                  value={
                    paper.tasks && paper.tasks.length > 0
                      ? paper.tasks.join(", ")
                      : "Not stated"
                  }
                />
                <FieldCard
                  label="Datasets"
                  value={
                    paper.datasets && paper.datasets.length > 0
                      ? paper.datasets.join(", ")
                      : "Not stated"
                  }
                />
                <FieldCard
                  label="Benchmarks"
                  value={
                    paper.benchmarks && paper.benchmarks.length > 0
                      ? paper.benchmarks.join(", ")
                      : "Not stated"
                  }
                />
              </div>

              {/* Implementation snippet */}
              <div className="mt-3 rounded-xl border bg-card p-4">
                <div className="mb-2 inline-flex items-center gap-2 text-xs text-muted-foreground">
                  <Info className="h-3.5 w-3.5" />
                  <span>Implementation snippet</span>
                </div>
                {codeUrl ? (
                  <pre className="overflow-x-auto rounded-md border bg-background p-3 text-xs leading-relaxed">
                    {`# Quickstart
git clone ${codeUrl}
cd $(basename ${codeUrl})
# See the repo README for setup and tasks
`}
                  </pre>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    No repository linked. Consider checking the arXiv page or
                    Papers with Code for implementations.
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Explainers */}
            <TabsContent value="explainers" className="mt-3">
              <ExplainerPanel
                title={paper.title}
                abstract={paper.abstract}
                defaultLevel="eli5"
                auto={false}
              />
            </TabsContent>

            {/* Reviewer */}
            <TabsContent value="reviewer" className="mt-3">
              <ReviewPanel
                title={paper.title}
                abstract={paper.abstract}
                auto={false}
              />
            </TabsContent>

            {/* Leaderboards */}
            <TabsContent value="leaderboards" className="mt-3">
              <LeaderboardLinks
                arxivId={paper.arxivId}
                title={paper.title}
                hintBenchmarks={paper.benchmarks}
              />
            </TabsContent>
          </Tabs>
        </section>

        {/* Right: details */}
        <aside className="space-y-3">
          <div className="rounded-xl border bg-card p-4">
            <h3 className="text-sm font-medium">Details</h3>
            <div className="mt-2 space-y-2 text-sm">
              <Line label="Published" value={formatFullDate(paper.published)} />
              <Line label="Updated" value={formatFullDate(paper.updated)} />
              <Line
                label="Categories"
                value={
                  <div className="flex flex-wrap gap-1">
                    {(paper.categories || []).map((c) => (
                      <Badge key={c} variant="outline">
                        {c}
                      </Badge>
                    ))}
                  </div>
                }
              />
              <div>
                <div className="text-xs text-muted-foreground">Authors</div>
                <div className="mt-1 text-sm">{paper.authors?.join(", ")}</div>
              </div>
            </div>
            <Separator className="my-3 opacity-50" />
            <div className="flex flex-wrap gap-2">
              <Button
                asChild
                variant="outline"
                size="sm"
                className="h-8 gap-1.5"
              >
                <Link href={absUrl} target="_blank" rel="noreferrer">
                  arXiv
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="sm"
                className="h-8 gap-1.5"
              >
                <Link href={pdfUrl} target="_blank" rel="noreferrer">
                  PDF
                  <FileText className="h-3.5 w-3.5" />
                </Link>
              </Button>
              {codeUrl ? (
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5"
                >
                  <Link href={codeUrl} target="_blank" rel="noreferrer">
                    Code
                    <Github className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              ) : null}
            </div>
          </div>

          <div className="rounded-xl border bg-card p-4">
            <h3 className="text-sm font-medium">Disclaimer</h3>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              Summaries, explainers, and reviewer notes are based on the arXiv
              title and abstract (and README if linked). No PDFs or RAG are used
              in the MVP. Treat all interpretations as provisional.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ========== Subcomponents ========== */

function FieldCard({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-sm">{value}</div>
    </div>
  );
}

function Line({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5">{value}</div>
    </div>
  );
}

/* ========== Utils ========== */

function stripVersion(arxivId: string) {
  return arxivId.replace(/v\d+$/i, "");
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

function relativeTime(iso: string) {
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

function formatFullDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}
