// components/papers/paper-badges.tsx
"use client";

import * as React from "react";
import { Github, Star, BarChart3, Package, Trophy } from "lucide-react";

export type PaperBadgesSource = {
  codeUrls?: string[];
  repoStars?: number | null;
  hasWeights?: boolean;
  benchmarks?: string[];
  claimedSota?: number | boolean;
};

export type PaperBadgesProps = {
  paper: PaperBadgesSource;
  className?: string;
  size?: "sm" | "md"; // visual size
  showLabels?: boolean; // hide text labels if false (icons only)
};

export function PaperBadges({
  paper,
  className,
  size = "sm",
  showLabels = true,
}: PaperBadgesProps) {
  const hasCode = (paper.codeUrls?.length ?? 0) > 0;
  const codeUrl = hasCode ? paper.codeUrls![0] : null;
  const hasBench = (paper.benchmarks?.length ?? 0) > 0;
  const benchCount = paper.benchmarks?.length ?? 0;
  const hasWeights = !!paper.hasWeights;
  const hasSota =
    typeof paper.claimedSota === "number"
      ? paper.claimedSota > 0
      : !!paper.claimedSota;

  if (!hasCode && !hasBench && !hasWeights && !hasSota) return null;

  const textSize = size === "sm" ? "text-[10px]" : "text-xs";
  const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  const padX = size === "sm" ? "px-1.5" : "px-2";
  const padY = size === "sm" ? "py-0.5" : "py-1";

  return (
    <div
      className={[
        "flex flex-wrap items-center gap-1.5",
        className || "",
      ].join(" ")}
    >
      {hasCode && (
        <a
          href={codeUrl!}
          target="_blank"
          rel="noreferrer"
          className={[
            "inline-flex items-center gap-1 rounded-md border bg-card/80 transition-colors hover:bg-accent",
            padX,
            padY,
            textSize,
          ].join(" ")}
          title="Open repository"
        >
          <Github className={`${iconSize} text-primary`} />
          {showLabels ? <span>Code</span> : null}
          {typeof paper.repoStars === "number" ? (
            <span className={`ml-1 inline-flex items-center gap-0.5 ${textSize} text-muted-foreground`}>
              <Star className={`h-3 w-3 fill-current text-primary`} />
              {formatCount(paper.repoStars)}
            </span>
          ) : null}
        </a>
      )}

      {hasBench && (
        <span
          className={[
            "inline-flex items-center gap-1 rounded-md border bg-card/80",
            padX,
            padY,
            textSize,
          ].join(" ")}
          title="Benchmarks mentioned"
        >
          <BarChart3 className={`${iconSize} text-primary`} />
          {showLabels ? <span>Benchmarks</span> : null}
          <span className="text-muted-foreground">
            {benchCount > 2 ? `${benchCount}` : paper.benchmarks!.join(", ")}
          </span>
        </span>
      )}

      {hasWeights && (
        <span
          className={[
            "inline-flex items-center gap-1 rounded-md border bg-card/80",
            padX,
            padY,
            textSize,
          ].join(" ")}
          title="Weights available"
        >
          <Package className={`${iconSize} text-primary`} />
          {showLabels ? <span>Weights</span> : null}
        </span>
      )}

      {hasSota && (
        <span
          className={[
            "inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 text-primary",
            padX,
            padY,
            textSize,
          ].join(" ")}
          title="SOTA claim (as stated in abstract)"
        >
          <Trophy className={iconSize} />
          {showLabels ? <span>SOTA claim</span> : null}
        </span>
      )}
    </div>
  );
}

export default PaperBadges;

/* ========== Local utils ========== */
function formatCount(n: number) {
  if (n < 1000) return `${n}`;
  if (n < 10_000) return `${(n / 1000).toFixed(1)}k`;
  return `${Math.round(n / 1000)}k`;
}