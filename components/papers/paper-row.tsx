// components/papers/paper-row.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, FileText, Github } from "lucide-react";
import { PaperBadges, UIPaper } from "@/components/papers/paper-card";

type PaperRowProps = {
  paper: UIPaper;
  className?: string;
  compact?: boolean; // tighter paddings
  showActions?: boolean; // show arXiv/PDF/Code buttons
  highlight?: string | string[]; // terms to highlight in title/summary
};

export function PaperRow({
  paper,
  className,
  compact = false,
  showActions = true,
  highlight,
}: PaperRowProps) {
  const baseId = stripVersion(paper.arxivId);
  const absUrl = `https://arxiv.org/abs/${baseId}`;
  const pdfUrl = paper.pdfUrl ?? `https://arxiv.org/pdf/${baseId}.pdf`;
  const codeUrl = paper.codeUrls?.[0] || null;
  const firstCat = paper.categories?.[0] || "cs.AI";

  const [open, setOpen] = React.useState(false);
  const terms = normalizeTerms(highlight);

  const titleNode = terms.length ? highlightText(paper.title, terms) : paper.title;
  const summaryNode = terms.length ? highlightText(paper.summary, terms) : paper.summary;

  return (
    <article
      className={[
        "group relative rounded-xl border bg-card transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-sm",
        compact ? "px-3 py-3" : "p-4",
        className || "",
      ].join(" ")}
    >
      {/* subtle vertical accent */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-3 bottom-3 w-px bg-gradient-to-b from-primary/0 via-primary/60 to-primary/0"
      />

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

          {/* Inline badges */}
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
          ) : null}
        </div>

        {/* Right: actions (desktop) */}
        {showActions ? (
          <div className="hidden items-start justify-end gap-2 md:flex">
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
        ) : null}
      </div>
    </article>
  );
}

export function PaperRowSkeleton({ className }: { className?: string }) {
  return (
    <div className={["relative rounded-xl border bg-card p-4", className || ""].join(" ")}>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-3 bottom-3 w-px bg-muted"
      />
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
          <div className="h-8 w-16 rounded-md bg-muted/50" />
        </div>
      </div>
    </div>
  );
}

/* ========== Local utils (kept in-file for portability) ========== */

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

function normalizeTerms(input?: string | string[]) {
  if (!input) return [] as string[];
  const list = Array.isArray(input) ? input : [input];
  const tokens = list
    .flatMap((s) => s.split(/[\s,;]+/g))
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
  return Array.from(new Set(tokens.map((t) => t.toLowerCase())));
}

function escapeRegex(str: string) {
  return str.replace(/[-\/\\^$*+?.()|[```{}]/g, "\\$&");
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