/* eslint-disable @typescript-eslint/no-explicit-any */
// hooks/useExplainer.ts
"use client";

/**
 * Streaming explainer hook for arXiv papers.
 * Calls /api/explain with { title, abstract, level, readme? } and streams text.
 *
 * Example:
 * const {
 *   level, setLevel, content, currentText, status, isLoading,
 *   generate, cancel, copied, copy, error
 * } = useExplainer({ title, abstract, readme, auto: true });
 */

import * as React from "react";

export type Level = "eli5" | "student" | "expert";
export type Status = "idle" | "loading" | "done" | "error";

export type UseExplainerOptions = {
  title: string;
  abstract: string;
  readme?: string;
  defaultLevel?: Level;
  auto?: boolean; // auto-generate for defaultLevel on mount if empty
  initial?: Partial<Record<Level, string>>; // preseed cached content per level
  onComplete?: (level: Level, text: string) => void;
  onError?: (err: unknown) => void;
};

export function useExplainer({
  title,
  abstract,
  readme,
  defaultLevel = "eli5",
  auto = false,
  initial,
  onComplete,
  onError,
}: UseExplainerOptions) {
  const [level, setLevel] = React.useState<Level>(defaultLevel);

  // Per-level content and status
  const [content, setContent] = React.useState<Record<Level, string>>({
    eli5: initial?.eli5 ?? "",
    student: initial?.student ?? "",
    expert: initial?.expert ?? "",
  });

  const hasInitial = Boolean(initial?.eli5 || initial?.student || initial?.expert);
  const [status, setStatus] = React.useState<Status>(hasInitial ? "done" : "idle");
  const [statuses, setStatuses] = React.useState<Record<Level, Status>>({
    eli5: initial?.eli5 ? "done" : "idle",
    student: initial?.student ? "done" : "idle",
    expert: initial?.expert ? "done" : "idle",
  });

  const [error, setError] = React.useState<string>("");
  const [copied, setCopied] = React.useState(false);
  const abortRef = React.useRef<AbortController | null>(null);

  // Current text (derived)
  const currentText = content[level] || "";
  const isLoading = status === "loading";

  // Keep refs to props to avoid stale closures
  const onCompleteRef = React.useRef(onComplete);
  const onErrorRef = React.useRef(onError);
  React.useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);
  React.useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  // Cancel on unmount
  React.useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const setLevelStatus = React.useCallback((lvl: Level, s: Status) => {
    setStatuses((prev) => ({ ...prev, [lvl]: s }));
    // Also reflect in global status for the active level
    if (lvl === level) setStatus(s);
  }, [level]);

  const generate = React.useCallback(
    async (lvl: Level = level) => {
      try {
        setError("");
        setCopied(false);
        setStatus("loading");
        setLevelStatus(lvl, "loading");

        // Reset this level’s content
        setContent((prev) => ({ ...prev, [lvl]: "" }));

        // Abort in-flight
        abortRef.current?.abort();
        abortRef.current = new AbortController();

        const res = await fetch("/api/explain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, abstract, level: lvl, readme }),
          signal: abortRef.current.signal,
        });

        if (!res.ok) {
          const t = await safeText(res);
          throw new Error(t || `Request failed (${res.status})`);
        }

        let acc = "";
        await readStream(res, (delta) => {
          acc += delta;
          setContent((prev) => ({ ...prev, [lvl]: (prev[lvl] || "") + delta }));
        });

        setStatus("done");
        setLevelStatus(lvl, "done");
        onCompleteRef.current?.(lvl, acc);
      } catch (err: any) {
        if (err?.name === "AbortError") {
          setStatus("idle");
          setLevelStatus(lvl, "idle");
          return;
        }
        const msg = err?.message || "Failed to generate explainer.";
        setError(msg);
        setStatus("error");
        setLevelStatus(lvl, "error");
        onErrorRef.current?.(err);
      } finally {
        abortRef.current = null;
      }
    },
    [title, abstract, readme, level, setLevelStatus]
  );

  const cancel = React.useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus("idle");
    setStatuses((prev) => ({ ...prev, [level]: "idle" }));
  }, [level]);

  // Optional auto start
  React.useEffect(() => {
    if (auto && !content[defaultLevel]) {
      generate(defaultLevel);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, defaultLevel]);

  const copy = React.useCallback(() => {
    const txt = currentText.trim();
    if (!txt) return;
    navigator.clipboard
      .writeText(txt)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      })
      .catch(() => {});
  }, [currentText]);

  return {
    // state
    level,
    setLevel,
    content,
    currentText,
    status,
    statuses,
    isLoading,
    error,
    copied,
    // actions
    generate,
    cancel,
    copy,
    // utils
    setContent, // exposed for manual seeding if needed
    setStatuses,
  };
}

/* ========== Streaming helpers (SSE + text) ========== */

async function readStream(res: Response, onToken: (delta: string) => void): Promise<void> {
  if (!res.body) {
    const t = await res.text();
    if (t) onToken(t);
    return;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const events = buffer.split(/\n\n/);
    buffer = events.pop() || "";

    for (const ev of events) {
      const dataLines = ev
        .split("\n")
        .filter((l) => l.trim().startsWith("data:"))
        .map((l) => l.replace(/^data:\s?/, "").trim());

      if (dataLines.length === 0) {
        onToken(ev);
        continue;
      }

      for (const line of dataLines) {
        if (!line || line === "[DONE]") continue;
        let added = false;
        try {
          const obj = JSON.parse(line);
          const text = extractDelta(obj) ?? (typeof obj === "string" ? obj : undefined);
          if (text) {
            onToken(text);
            added = true;
          }
        } catch {
          // Treat as raw text
        }
        if (!added) onToken(line);
      }
    }
  }

  if (buffer.trim()) {
    onToken(buffer);
  }
}

function extractDelta(obj: any): string | undefined {
  if (typeof obj?.type === "string") {
    if (typeof obj?.delta === "string") return obj.delta;
    if (typeof obj?.text === "string") return obj.text;
    if (typeof obj?.value === "string") return obj.value;
    if (typeof obj?.content === "string") return obj.content;
  }
  if (Array.isArray(obj?.choices)) {
    const c = obj.choices[0];
    const content = c?.delta?.content ?? c?.text ?? c?.message?.content;
    if (typeof content === "string") return content;
  }
  if (typeof obj?.data === "string") return obj.data;
  return undefined;
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}