/* eslint-disable @typescript-eslint/no-explicit-any */
// components/papers/summary-stream.tsx
"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sparkles, Loader2, RotateCcw, StopCircle, Info } from "lucide-react";

type Status = "idle" | "loading" | "done" | "error";

type SummaryStreamProps = {
  title: string;
  abstract: string;
  className?: string;
  compact?: boolean;
  auto?: boolean; // auto-start on mount
  onComplete?: (text: string) => void;
  onError?: (err: unknown) => void;
};

export default function SummaryStream({
  title,
  abstract,
  className,
  compact = false,
  auto = false,
  onComplete,
  onError,
}: SummaryStreamProps) {
  const [status, setStatus] = React.useState<Status>("idle");
  const [raw, setRaw] = React.useState<string>("");
  const [errMsg, setErrMsg] = React.useState<string>("");
  const abortRef = React.useRef<AbortController | null>(null);

  const start = React.useCallback(async () => {
    try {
      setStatus("loading");
      setErrMsg("");
      setRaw("");
      abortRef.current?.abort();
      abortRef.current = new AbortController();

      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, abstract }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const t = await safeText(res);
        throw new Error(t || `Request failed (${res.status})`);
      }

      // Accumulate locally to avoid closure timing issues
      let acc = "";
      await readStream(res, (chunk) => {
        acc += chunk;
        setRaw((prev) => prev + chunk);
      });

      setStatus("done");
      onComplete?.(acc);
    } catch (err: any) {
      if (err?.name === "AbortError") {
        setStatus("idle");
        return;
      }
      setStatus("error");
      const msg = err?.message || "Failed to generate summary.";
      setErrMsg(msg);
      onError?.(err);
    } finally {
      abortRef.current = null;
    }
  }, [title, abstract, onComplete, onError]);

  const cancel = React.useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus("idle");
  }, []);

  React.useEffect(() => {
    if (auto) start();
  }, [auto, start]);

  const { oneLiner, bullets } = React.useMemo(() => parseSummary(raw), [raw]);

  return (
    <div
      className={[
        "rounded-xl border bg-card",
        compact ? "p-3" : "p-4",
        className || "",
      ].join(" ")}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-2 rounded-md bg-accent px-2 py-1 text-xs ring-1 ring-ring">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span>Quick take (title + abstract only)</span>
        </div>
        <div className="flex items-center gap-2">
          {status === "loading" ? (
            <>
              <Button variant="ghost" size="sm" className="h-8 gap-1.5" onClick={cancel}>
                <StopCircle className="h-4 w-4" />
                Stop
              </Button>
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Generating…
              </span>
            </>
          ) : (
            <>
              {status === "done" ? (
                <Button variant="secondary" size="sm" className="h-8 gap-1.5" onClick={start}>
                  <RotateCcw className="h-4 w-4" />
                  Regenerate
                </Button>
              ) : (
                <Button className="btn-primary h-8" size="sm" onClick={start}>
                  Generate
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      <Separator className="my-3 opacity-50" />

      {/* Streaming content */}
      <div className="space-y-2" aria-live="polite" aria-busy={status === "loading"}>
        {status === "idle" && !raw ? (
          <p className="text-sm text-muted-foreground">
            Click Generate to stream a 1‑liner and 3–5 bullets.
          </p>
        ) : null}

        {oneLiner ? (
          <p className="text-sm leading-relaxed">{oneLiner}</p>
        ) : status === "loading" ? (
          <SkeletonLines lines={1} />
        ) : null}

        {bullets.length > 0 ? (
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {bullets.map((b, i) => (
              <li key={`${i}-${b.slice(0, 24)}`}>{b}</li>
            ))}
          </ul>
        ) : status === "loading" ? (
          <SkeletonLines lines={3} />
        ) : null}

        {status === "error" ? (
          <div className="mt-2 inline-flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
            <Info className="mt-0.5 h-3.5 w-3.5" />
            <span>{errMsg}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ========== Helpers ========== */

function SkeletonLines({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-3 w-full rounded bg-muted/50" />
      ))}
    </div>
  );
}

async function readStream(
  res: Response,
  onToken: (delta: string) => void
): Promise<void> {
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
          const text =
            extractDelta(obj) ??
            (typeof obj === "string" ? obj : undefined);
          if (text) {
            onToken(text);
            added = true;
          }
        } catch {
          // treat as text
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

function parseSummary(text: string): { oneLiner: string; bullets: string[] } {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  let oneLiner = "";
  const bullets: string[] = [];

  for (const l of lines) {
    const isBullet = /^[-–•\u2022]|^\d+\./.test(l);
    if (!oneLiner && !isBullet) {
      oneLiner = stripLead(l);
      continue;
    }
    if (isBullet) {
      const cleaned = l.replace(/^[-–•\u2022]\s?/, "").replace(/^\d+\.\s?/, "");
      if (cleaned) bullets.push(cleaned);
    }
  }

  if (!oneLiner && bullets.length) {
    oneLiner = bullets.shift() || "";
  }

  return {
    oneLiner,
    bullets: bullets.slice(0, 6),
  };
}

function stripLead(s: string) {
  return s.replace(/^Takeaway:\s*/i, "").replace(/^Summary:\s*/i, "");
}