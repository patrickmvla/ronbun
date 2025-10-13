/* eslint-disable @typescript-eslint/no-explicit-any */
// components/papers/review-panel.tsx
"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Beaker,
  RotateCcw,
  StopCircle,
  Clipboard,
  ClipboardCheck,
  Info,
} from "lucide-react";

/* Types align with lib/zod.ts Review schema (kept local for portability) */
export type ReviewJSON = {
  strengths: string[];
  weaknesses: string[];
  risks: string[];
  next_experiments: string[];
  reproducibility_notes: string | null;
  novelty_score: number | null; // 0–3
  clarity_score: number | null; // 0–3
  caveats?: string | null;
};

type Status = "idle" | "loading" | "done" | "error";

// Accept booleanish values for auto to avoid TS2322 at call sites like auto={cond && "true"}
type Booleanish = boolean | string | number | null | undefined;

type ReviewPanelProps = {
  title: string;
  abstract: string;
  readme?: string;
  className?: string;
  auto?: Booleanish; // auto-generate on mount (booleanish)
  initialReview?: Partial<ReviewJSON>;
  onComplete?: (review: ReviewJSON) => void;
  onError?: (err: unknown) => void;
};

// Class combiner that never returns boolean
function cx(...parts: Array<string | null | undefined | false>) {
  return parts.filter(Boolean).join(" ");
}

// Normalize booleanish values
function toBool(v: Booleanish): boolean {
  if (v == null) return false;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    // Only treat standard "truthy" tokens as true; everything else -> false
    return s === "true" || s === "1" || s === "yes" || s === "on";
  }
  return false;
}

export default function ReviewPanel({
  title,
  abstract,
  readme,
  className,
  auto = false,
  initialReview,
  onComplete,
  onError,
}: ReviewPanelProps) {
  // Coerce auto to a real boolean to avoid string|false leaking into logic
  const autoFlag = toBool(auto);

  // Normalize initial review once for both initial state and initial status
  const [review, setReview] = React.useState<ReviewJSON>(() =>
    normalizeReview(initialReview)
  );
  const initialStatus: Status = hasAnyReviewContent(review) ? "done" : "idle";
  const [status, setStatus] = React.useState<Status>(initialStatus);
  const isLoading = status === "loading";

  const [errMsg, setErrMsg] = React.useState<string>("");
  const [copied, setCopied] = React.useState(false);

  const abortRef = React.useRef<AbortController | null>(null);
  const mounted = React.useRef(true);
  const requestIdRef = React.useRef(0);
  const copyTimerRef = React.useRef<number | null>(null);
  const autoRanRef = React.useRef(false);

  const generate = React.useCallback(async () => {
    const myReqId = ++requestIdRef.current;

    try {
      setStatus("loading");
      setErrMsg("");
      setCopied(false);

      abortRef.current?.abort();
      abortRef.current = new AbortController();

      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, abstract, readme }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const t = await safeText(res);
        throw new Error(t || `Request failed (${res.status})`);
      }

      const json = await res.json();
      const normalized = normalizeReview(json);

      if (!mounted.current) return;
      if (myReqId !== requestIdRef.current) return;

      setReview(normalized);
      setStatus("done");
      try {
        onComplete?.(normalized);
      } catch {
        // swallow callback errors to avoid flipping UI state
      }
    } catch (err: any) {
      if (err?.name === "AbortError") {
        if (!mounted.current) return;
        if (myReqId === requestIdRef.current) setStatus("idle");
        return;
      }
      if (!mounted.current) return;
      if (myReqId === requestIdRef.current) {
        setStatus("error");
        const msg = err?.message || "Failed to generate review.";
        setErrMsg(msg);
        onError?.(err);
      }
    } finally {
      if (myReqId === requestIdRef.current) {
        abortRef.current = null;
      }
    }
  }, [title, abstract, readme, onComplete, onError]);

  const cancel = React.useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus("idle");
  }, []);

  // Abort + cleanup on unmount
  React.useEffect(() => {
    return () => {
      mounted.current = false;
      abortRef.current?.abort();
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
    };
  }, []);

  // Auto-generate on mount if requested and no initial content (gated for StrictMode)
  React.useEffect(() => {
    if (!autoRanRef.current && autoFlag && !hasAnyReviewContent(review)) {
      autoRanRef.current = true;
      generate();
    }
  }, [autoFlag, review, generate]);

  const copyJSON = React.useCallback(() => {
    const payload = JSON.stringify(review, null, 2);
    navigator.clipboard
      .writeText(payload)
      .then(() => {
        setCopied(true);
        if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
        copyTimerRef.current = window.setTimeout(() => setCopied(false), 1200);
      })
      .catch(() => {
        // no-op
      });
  }, [review]);

  return (
    <div
      className={cx("rounded-xl border bg-card p-4", className)}
      aria-busy={!!isLoading}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-2 rounded-md bg-accent px-2 py-1 text-xs ring-1 ring-ring">
          <Beaker className="h-3.5 w-3.5 text-primary" />
          <span>Reviewer mode</span>
        </div>

        <div className="flex items-center gap-2">
          {isLoading ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5"
              onClick={cancel}
            >
              <StopCircle className="h-4 w-4" />
              Stop
            </Button>
          ) : (
            <>
              <Button
                variant={status === "done" ? "secondary" : "default"}
                size="sm"
                className={
                  status === "done" ? "h-8 gap-1.5" : "btn-primary h-8 gap-1.5"
                }
                onClick={generate}
              >
                {status === "done" ? (
                  <>
                    <RotateCcw className="h-4 w-4" />
                    Regenerate
                  </>
                ) : (
                  "Generate"
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5"
                onClick={copyJSON}
                disabled={!!(status !== "done")}
                aria-label="Copy review JSON"
              >
                {copied ? (
                  <>
                    <ClipboardCheck className="h-4 w-4" />
                    Copied
                  </>
                ) : (
                  <>
                    <Clipboard className="h-4 w-4" />
                    Copy JSON
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="mt-2 inline-flex items-center gap-2 text-xs text-muted-foreground">
        <Info className="h-3.5 w-3.5" />
        Based on title + abstract{readme ? " + README" : ""}. No PDFs or RAG.
      </div>

      <Separator className="my-3 opacity-50" />

      {/* Content */}
      {isLoading ? (
        <ReviewSkeleton />
      ) : status === "error" ? (
        <div
          className="inline-flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive"
          role="alert"
        >
          <Info className="mt-0.5 h-3.5 w-3.5" />
          <span>{errMsg}</span>
        </div>
      ) : (
        <div className="grid gap-3">
          {/* Lists */}
          <div className="grid gap-3 md:grid-cols-2">
            <ReviewList title="Strengths" items={review.strengths} />
            <ReviewList title="Weaknesses" items={review.weaknesses} />
            <ReviewList title="Risks" items={review.risks} />
            <ReviewList
              title="Next experiments"
              items={review.next_experiments}
            />
          </div>

          <Separator className="opacity-50" />

          {/* Scores + notes */}
          <div className="grid gap-3 md:grid-cols-3">
            <ScoreCard label="Novelty" value={review.novelty_score} />
            <ScoreCard label="Clarity" value={review.clarity_score} />
            <div className="rounded-lg border bg-card/80 p-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Reproducibility notes
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                {review.reproducibility_notes || "Not stated"}
              </div>
            </div>
          </div>

          {review.caveats ? (
            <div className="rounded-lg border bg-card/80 p-3 text-sm text-muted-foreground">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Caveats
              </div>
              <div className="mt-1">{review.caveats}</div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

/* ========== Subcomponents ========== */

function ReviewList({ title, items }: { title: string; items: string[] }) {
  const hasItems = Array.isArray(items) && items.length > 0;
  return (
    <div className="rounded-lg border bg-card/80 p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      {hasItems ? (
        <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-muted-foreground">
          {items.map((s, i) => (
            <li key={`${title}-${i}-${s.slice(0, 24)}`}>{s}</li>
          ))}
        </ul>
      ) : (
        <div className="mt-1 text-sm text-muted-foreground">Not stated</div>
      )}
    </div>
  );
}

function ScoreCard({ label, value }: { label: string; value: number | null }) {
  const clamped =
    typeof value === "number" && isFinite(value)
      ? Math.max(0, Math.min(3, Math.round(value)))
      : null;

  return (
    <div className="rounded-lg border bg-card/80 p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 flex items-center gap-2">
        <ScoreDots value={clamped} />
        <span className="text-sm text-muted-foreground">
          {clamped === null ? "N/A" : `${clamped}/3`}
        </span>
      </div>
    </div>
  );
}

function ScoreDots({ value }: { value: number | null }) {
  return (
    <div className="inline-flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={cx(
            "inline-block h-2.5 w-2.5 rounded-full ring-1 ring-ring",
            value !== null && i < value ? "bg-primary" : "bg-card"
          )}
        />
      ))}
    </div>
  );
}

function ReviewSkeleton() {
  return (
    <div className="grid gap-3">
      <div className="grid gap-3 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-card/80 p-3">
            <div className="h-3 w-28 rounded bg-muted/60" />
            <div className="mt-2 space-y-2">
              <div className="h-3 w-full rounded bg-muted/50" />
              <div className="h-3 w-4/5 rounded bg-muted/50" />
              <div className="h-3 w-3/5 rounded bg-muted/50" />
            </div>
          </div>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-card/80 p-3">
            <div className="h-3 w-36 rounded bg-muted/60" />
            <div className="mt-2 h-3 w-16 rounded bg-muted/50" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ========== Helpers ========== */

function hasAnyReviewContent(r: ReviewJSON): boolean {
  return (
    (Array.isArray(r.strengths) && r.strengths.length > 0) ||
    (Array.isArray(r.weaknesses) && r.weaknesses.length > 0) ||
    (Array.isArray(r.risks) && r.risks.length > 0) ||
    (Array.isArray(r.next_experiments) && r.next_experiments.length > 0) ||
    r.reproducibility_notes != null ||
    r.novelty_score != null ||
    r.clarity_score != null ||
    (typeof r.caveats === "string" && r.caveats.trim().length > 0)
  );
}

function normalizeReview(input?: Partial<ReviewJSON> | any): ReviewJSON {
  function isNonEmptyString(x: unknown): x is string {
    return typeof x === "string" && x.trim().length > 0;
  }

  const toArr = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter(isNonEmptyString) : [];

  const toStr = (v: unknown): string | null => (isNonEmptyString(v) ? v : null);
  const toInt = (v: unknown): number | null => {
    if (v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(0, Math.min(3, Math.round(n))) : null;
  };

  return {
    strengths: toArr(input?.strengths),
    weaknesses: toArr(input?.weaknesses),
    risks: toArr(input?.risks),
    next_experiments: toArr(input?.next_experiments),
    reproducibility_notes: toStr(input?.reproducibility_notes),
    novelty_score: toInt(input?.novelty_score),
    clarity_score: toInt(input?.clarity_score),
    caveats: toStr(input?.caveats),
  };
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}
