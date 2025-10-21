/* eslint-disable @typescript-eslint/no-explicit-any */
// components/compare/paper-column.tsx
import * as React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ExternalLink, FileText, Sparkles } from "lucide-react";

import PaperBadges from "@/components/papers/paper-badges";
import DetailField from "./detail-field";
import {
  stripVersion,
  formatFullDate,
  relativeTime,
  quickSummary,
} from "@/lib/compare-utils";
import type { CompareItem } from "@/types/compare";

export default function PaperColumn({
  paper,
  placeholder,
}: {
  paper: CompareItem | null;
  placeholder: "A" | "B";
}) {
  if (!paper) {
    return (
      <div className="rounded-xl border bg-card/80 p-4 text-sm text-muted-foreground">
        Paste a valid arXiv ID above to compare Paper {placeholder}.
      </div>
    );
  }

  if (!paper.found) {
    return (
      <div className="rounded-xl border bg-card/80 p-4 text-sm">
        <div className="text-sm font-medium">Paper {placeholder}</div>
        <p className="mt-1 text-muted-foreground">
          {paper.arxivId
            ? `Not found in the database yet (arXiv ${paper.arxivId}).`
            : "Not found."}
        </p>
      </div>
    );
  }

  const baseId = stripVersion(paper.arxivId);
  const absUrl = paper.links?.abs ?? `https://arxiv.org/abs/${baseId}`;
  const pdfUrl = paper.pdfUrl ?? `https://arxiv.org/pdf/${baseId}.pdf`;
  const authors = paper.authors ?? [];
  const cat = paper.categories?.[0] || "cs.AI";
  const quick = quickSummary(paper);

  return (
    <article className="rounded-xl border bg-card p-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <div className="flex items-center gap-2">
            <Badge variant="outline">{cat}</Badge>
            <span className="text-[11px] text-muted-foreground">
              {formatFullDate(paper.published || "")} • {relativeTime(paper.published || "")}
            </span>
          </div>
          <h2 className="mt-1 line-clamp-3 text-[15px] font-medium leading-snug">
            <Link href={`/paper/${baseId}`} className="hover:underline">
              {paper.title || baseId}
            </Link>
          </h2>
          <div className="mt-1 truncate text-xs text-muted-foreground">
            {authors.join(", ")}
          </div>
        </div>
        <div className="flex shrink-0 items-start gap-2">
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
        </div>
      </div>

      {/* Badges */}
      <PaperBadges paper={paper as any} className="mt-2" />

      <Separator className="my-3 opacity-50" />

      {/* Quick take */}
      <div className="rounded-lg border bg-card/80 p-3">
        <div className="mb-1 inline-flex items-center gap-2 text-xs">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          Quick take
        </div>
        <p className="text-sm leading-relaxed">{quick.oneLiner}</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {quick.bullets.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      </div>

      {/* Structured fields */}
      <div className="mt-3 grid gap-3">
        <DetailField label="Method" value={paper.method || "Not stated"} />
        <DetailField
          label="Tasks"
          value={(paper.tasks?.length ?? 0) > 0 ? (paper.tasks || []).join(", ") : "Not stated"}
        />
        <DetailField
          label="Datasets"
          value={(paper.datasets?.length ?? 0) > 0 ? (paper.datasets || []).join(", ") : "Not stated"}
        />
        <DetailField
          label="Benchmarks"
          value={(paper.benchmarks?.length ?? 0) > 0 ? (paper.benchmarks || []).join(", ") : "Not stated"}
        />
      </div>
    </article>
  );
}