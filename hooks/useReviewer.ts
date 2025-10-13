// hooks/useReviewer.ts
"use client";

/**
 * useReviewer — generate a structured review for a paper (non‑streaming).
 * Calls POST /api/review with { title, abstract, readme? } and returns JSON.
 *
 * Example:
 * const {
 *   review, status, isLoading, error, copied,
 *   generate, cancel, copy, setReview
 * } = useReviewer({ title, abstract, readme, auto: true });
 */

import * as React from "react";

export type Status = "idle" | "loading" | "done" | "error";

/**
 * Aligns with lib/zod.ts Review schema (snake_case).
 */
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

export type UseReviewerOptions = {
  title: string;
  abstract: string;
  readme?: string;
  auto?: boolean; // auto-generate on mount
  initial?: Partial<ReviewJSON>; // seed review to avoid first render empty
  onComplete?: (review: ReviewJSON) => void;
  onError?: (err: unknown) => void;
};

export function useReviewer({
  title,
  abstract,
  readme,
  auto = false,
  initial,
  onComplete,
  onError,
}: UseReviewerOptions) {
  const [status, setStatus] = React.useState<Status>(initial ? "done" : "idle");
  const [review, setReview] = React.useState<ReviewJSON>(() =>
    normalizeReview(initial)
  );
  const [error, setError] = React.useState<string>("");
  const [copied, setCopied] = React.useState(false);
  const abortRef = React.useRef<AbortController | null>(null);

  const isLoading = status === "loading";

  // Stable refs for callbacks
  const onCompleteRef = React.useRef(onComplete);
  const onErrorRef = React.useRef(onError);
  React.useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);
  React.useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  // Cancel in-flight on unmount
  React.useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const generate = React.useCallback(async () => {
    try {
      setStatus("loading");
      setError("");
      setCopied(false);

      // Abort previous
      abortRef.current?.abort();
      abortRef.current = new AbortController();

      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, abstract, readme }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const msg = await safeText(res);
        throw new Error(msg || `Request failed (${res.status})`);
      }

      const json = await res.json();
      const normalized = normalizeReview(json);
      setReview(normalized);
      setStatus("done");
      onCompleteRef.current?.(normalized);
    } catch (err: any) {
      if (err?.name === "AbortError") {
        setStatus("idle");
        return;
      }
      const msg = err?.message || "Failed to generate review.";
      setError(msg);
      setStatus("error");
      onErrorRef.current?.(err);
    } finally {
      abortRef.current = null;
    }
  }, [title, abstract, readme]);

  const cancel = React.useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus("idle");
  }, []);

  const copy = React.useCallback(() => {
    const payload = JSON.stringify(review, null, 2);
    navigator.clipboard
      .writeText(payload)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      })
      .catch(() => {});
  }, [review]);

  // Optional auto-generate
  React.useEffect(() => {
    if (auto && status === "idle") {
      generate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto]);

  return {
    // state
    review,
    status,
    isLoading,
    error,
    copied,
    // actions
    generate,
    cancel,
    copy,
    setReview, // exposed for manual edits/seeding if needed
  };
}

/* ========== Helpers ========== */

function normalizeReview(input?: Partial<ReviewJSON> | any): ReviewJSON {
  const toArr = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((s): s is string => typeof s === "string" && s.trim()) : [];
  const toInt = (v: unknown): number | null => {
    if (v === null || v === undefined) return null;
    const n = Number(v);
    return Number.isFinite(n) ? clamp(Math.round(n), 0, 3) : null;
  };
  const toStr = (v: unknown): string | null =>
    typeof v === "string" && v.trim() ? v : null;

  // Accept both snake_case and camelCase to be resilient
  return {
    strengths: toArr(input?.strengths),
    weaknesses: toArr(input?.weaknesses),
    risks: toArr(input?.risks),
    next_experiments: toArr(input?.next_experiments ?? input?.nextExperiments),
    reproducibility_notes:
      toStr(input?.reproducibility_notes ?? input?.reproducibilityNotes),
    novelty_score: toInt(input?.novelty_score ?? input?.noveltyScore),
    clarity_score: toInt(input?.clarity_score ?? input?.clarityScore),
    caveats: toStr(input?.caveats),
  };
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}