// components/papers/paper-card.tsx
"use client";

// cspell:ignore arXiv
import * as React from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ExternalLink,
  FileText,
  Github,
  Star,
  Trophy,
  BarChart3,
  Package,
} from "lucide-react";

export type UIPaper = {
  arxivId: string; // e.g., 2501.10000 or 2501.10000v2
  title: string;
  summary: string;
  authors: string[];
  categories: string[];
  published: string; // ISO
  updated?: string; // ISO
  pdfUrl?: string | null;

  // Optional enrichment
  codeUrls?: string[];
  repoStars?: number | null;
  hasWeights?: boolean;
  benchmarks?: string[];
  claimedSota?: number; // count
};

type PaperCardProps = {
  paper: UIPaper;
  className?: string;
  compact?: boolean;
  showActions?: boolean;
  // Search terms or query string to softly highlight in title/summary
  highlight?: string | string[];
};

export function PaperCard({
  paper,
  className,
  compact = false,
  showActions = true,
  highlight,
}: PaperCardProps) {
  const baseId = stripVersion(paper.arxivId);
  const absUrl = `https://arxiv.org/abs/${baseId}`;
  const pdfUrl = paper.pdfUrl ?? `https://arxiv.org/pdf/${baseId}.pdf`;
  const firstCat = paper.categories?.[0] || "cs.AI";

  const [open, setOpen] = React.useState(false);
  const terms = normalizeTerms(highlight);

  const titleNode = terms.length ? highlightText(paper.title, terms) : paper.title;
  const summaryNode = terms.length ? highlightText(paper.summary, terms) : paper.summary;

  const hasCode = (paper.codeUrls?.length ?? 0) > 0;
  const codeUrl = hasCode ? paper.codeUrls![0] : null;

  return (
    <Card
      className={[
        "group transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-sm",
        compact ? "p-0" : "p-0",
        className || "",
      ].join(" ")}
    >
      <CardContent className={compact ? "p-3" : "p-4"}>
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          {/* Left: title, meta, badges, abstract */}
          <div className="min-w-0">
            {/* Title */}
            <h3 className="text-[15px] font-medium leading-snug">
              <Link href={`/paper/${baseId}`} className="hover:underline" title="Open paper page">
                {titleNode}
              </Link>
            </h3>

            {/* Meta */}
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <Badge variant="outline" className="px-1.5 py-0.5 text-[10px]">
                {firstCat}
              </Badge>
              <span className="select-none">•</span>
              <span>{relativeTime(paper.published)}</span>
              <span className="select-none">•</span>
              <span className="truncate">
                {paper.authors.slice(0, 3).join(", ")}
                {paper.authors.length > 3 ? " et al." : ""}
              </span>
            </div>

            {/* Badges */}
            <PaperBadges paper={paper} className="mt-2" />

            {/* Abstract */}
            <div className={compact ? "mt-1" : "mt-2"}>
              <p className={`text-sm text-muted-foreground ${!open ? "max-h-12 overflow-hidden" : ""}`}>
                {summaryNode}
              </p>
              <button
                type="button"
                className="mt-1 inline-flex h-7 items-center rounded px-1.5 text-xs text-primary hover:underline"
                onClick={() => setOpen((v) => !v)}
              >
                {open ? "Show less" : "Quick look"}
              </button>
            </div>

            {/* Mobile actions */}
            {showActions ? (
              <div className="mt-2 flex gap-2 md:hidden">
                <Button asChild variant="outline" size="sm" className="h-8 gap-1.5">
                  <Link href={absUrl} target="_blank" rel="noopener noreferrer">
                    arXiv
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="h-8 gap-1.5">
                  <Link href={pdfUrl} target="_blank" rel="noopener noreferrer">
                    PDF
                    <FileText className="h-3.5 w-3.5" />
                  </Link>
                </Button>
                {hasCode && codeUrl ? (
                  <Button asChild variant="outline" size="sm" className="h-8 gap-1.5">
                    <Link href={codeUrl} target="_blank" rel="noopener noreferrer">
                      Code
                      <Github className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* Right: actions (desktop) */}
          {showActions ? (
            <div className="hidden items-start justify-end gap-2 md:flex">
              <Button asChild variant="outline" size="sm" className="h-8 gap-1.5">
                <Link href={absUrl} target="_blank" rel="noopener noreferrer">
                  arXiv
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="h-8 gap-1.5">
                <Link href={pdfUrl} target="_blank" rel="noopener noreferrer">
                  PDF
                  <FileText className="h-3.5 w-3.5" />
                </Link>
              </Button>
              {hasCode && codeUrl ? (
                <Button asChild variant="outline" size="sm" className="h-8 gap-1.5">
                  <Link href={codeUrl} target="_blank" rel="noopener noreferrer">
                    Code
                    <Github className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

export function PaperCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={["rounded-xl border bg-card p-4", className || ""].join(" ")}>
      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
        <div className="w-full animate-pulse space-y-2">
          <div className="h-4 w-3/4 rounded bg-muted/60" />
          <div className="flex items-center gap-2">
            <div className="h-5 w-16 rounded-md bg-muted" />
            <div className="h-3 w-32 rounded bg-muted/70" />
            <div className="h-3 w-24 rounded bg-muted/70" />
          </div>
          <div className="h-3 w-40 rounded bg-muted/50" />
          <div className="h-3 w-full rounded bg-muted/50" />
          <div className="h-3 w-5/6 rounded bg-muted/50" />
        </div>
        <div className="hidden items-start justify-end gap-2 md:flex">
          <div className="h-8 w-16 rounded-md bg-muted/60" />
          <div className="h-8 w-16 rounded-md bg-muted/50" />
        </div>
      </div>
    </div>
  );
}

/* Badges row (inline export so you can reuse elsewhere if needed) */
export function PaperBadges({
  paper,
  className,
}: {
  paper: UIPaper;
  className?: string;
}) {
  const hasCode = (paper.codeUrls?.length ?? 0) > 0;
  const codeUrl = hasCode ? paper.codeUrls![0] : null;
  const hasBench = (paper.benchmarks?.length ?? 0) > 0;
  const benchCount = paper.benchmarks?.length ?? 0;
  const hasWeights = !!paper.hasWeights;
  const hasSota = (paper.claimedSota ?? 0) > 0;

  if (!hasCode && !hasBench && !hasWeights && !hasSota) return null;

  return (
    <div className={["flex flex-wrap items-center gap-1.5", className || ""].join(" ")}>
      {hasCode && (
        <Badge asChild variant="secondary" className="gap-1 px-1.5 py-0.5 text-[10px]">
          <a href={codeUrl!} target="_blank" rel="noopener noreferrer" title="Open repository">
            <span className="inline-flex items-center gap-1">
              <Github className="h-3.5 w-3.5 text-primary" />
              <span>Code</span>
              {typeof paper.repoStars === "number" ? (
                <span className="ml-1 inline-flex items-center gap-0.5 text-muted-foreground">
                  <Star className="h-3 w-3 fill-current text-primary" />
                  {formatCount(paper.repoStars)}
                </span>
              ) : null}
            </span>
          </a>
        </Badge>
      )}

      {hasBench && (
        <Badge variant="outline" className="gap-1 px-1.5 py-0.5 text-[10px]">
          <BarChart3 className="h-3.5 w-3.5 text-primary" />
          <span>Benchmarks</span>
          <span className="text-muted-foreground">
            {benchCount > 2 ? `${benchCount}` : paper.benchmarks!.join(", ")}
          </span>
        </Badge>
      )}

      {hasWeights && (
        <Badge variant="outline" className="gap-1 px-1.5 py-0.5 text-[10px]">
          <Package className="h-3.5 w-3.5 text-primary" />
          <span>Weights</span>
        </Badge>
      )}

      {hasSota && (
        <Badge variant="secondary" className="gap-1 px-1.5 py-0.5 text-[10px] border-primary/30 bg-primary/10 text-primary">
          <Trophy className="h-3.5 w-3.5" />
          <span>SOTA claim</span>
        </Badge>
      )}
    </div>
  );
}

/* ========== Utils (local) ========== */

function stripVersion(arxivId: string) {
  return arxivId.replace(/v\d+$/i, "");
}

function relativeTime(iso: string) {
  const d = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - d);
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d2 = Math.floor(h / 24);
  if (d2 < 7) return `${d2}d`;
  const w = Math.floor(d2 / 7);
  return `${w}w`;
}

function formatCount(n: number) {
  if (n < 1000) return `${n}`;
  if (n < 10_000) return `${(n / 1000).toFixed(1)}k`;
  return `${Math.round(n / 1000)}k`;
}

function normalizeTerms(input?: string | string[]) {
  if (!input) return [] as string[];
  const list = Array.isArray(input) ? input : [input];
  const tokens = list
    .flatMap((s) => s.split(/[\s,;]+/g))
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
  // dedupe
  return Array.from(new Set(tokens.map((t) => t.toLowerCase())));
}

function escapeRegex(str: string): string {
  // Escapes special regex characters
  return str.replace(/[-\/\\^$*+?.()|[```{}]/g, '\\$&');
}

function highlightText(text: string, terms: string[]) {
  if (!terms.length) return text;
  const escaped = terms.map(escapeRegex);
  const re = new RegExp(`(${escaped.join("|")})`, "gi");
  const parts = text.split(re);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <mark key={i} className="rounded bg-primary/20 px-0.5 text-foreground">
        {part}
      </mark>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    )
  );
}