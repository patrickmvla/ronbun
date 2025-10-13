/* eslint-disable @typescript-eslint/no-explicit-any */
// components/papers/explainer-panel.tsx
"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  GraduationCap,
  RotateCcw,
  StopCircle,
  Clipboard,
  ClipboardCheck,
  Info,
  Sparkles,
} from "lucide-react";

type Level = "eli5" | "student" | "expert";
type Status = "idle" | "loading" | "done" | "error";

type ExplainerPanelProps = {
  title: string;
  abstract: string;
  readme?: string;
  className?: string;
  defaultLevel?: Level;
  auto?: boolean; // auto-generate for defaultLevel on mount if empty
  initial?: Partial<Record<Level, string>>; // seed cached content per level
  onComplete?: (level: Level, text: string) => void;
  onError?: (err: unknown) => void;
};

export default function ExplainerPanel({
  title,
  abstract,
  readme,
  className,
  defaultLevel = "eli5",
  auto = false,
  initial,
  onComplete,
  onError,
}: ExplainerPanelProps) {
  const [level, setLevel] = React.useState<Level>(defaultLevel);
  const [content, setContent] = React.useState<Record<Level, string>>({
    eli5: initial?.eli5 ?? "",
    student: initial?.student ?? "",
    expert: initial?.expert ?? "",
  });

  const hasInitial = Boolean(initial?.eli5 || initial?.student || initial?.expert);

  // Ensure state includes "loading"
  const initialStatus: Status = hasInitial ? "done" : "idle";
  const [status, setStatus] = React.useState<Status>(initialStatus);

  const isStreaming = status === "loading";

  const [errMsg, setErrMsg] = React.useState<string>("");
  const [copied, setCopied] = React.useState(false);
  const abortRef = React.useRef<AbortController | null>(null);

  const generate = React.useCallback(
    async (lvl: Level) => {
      try {
        setStatus("loading");
        setErrMsg("");
        setCopied(false);
        abortRef.current?.abort();
        abortRef.current = new AbortController();

        // reset this level’s content before streaming
        setContent((prev) => ({ ...prev, [lvl]: "" }));

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
        onComplete?.(lvl, acc);
      } catch (err: any) {
        if (err?.name === "AbortError") {
          setStatus("idle");
          return;
        }
        setStatus("error");
        const msg = err?.message || "Failed to generate explainer.";
        setErrMsg(msg);
        onError?.(err);
      } finally {
        abortRef.current = null;
      }
    },
    [title, abstract, readme, onComplete, onError]
  );

  const cancel = React.useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus("idle");
  }, []);

  // Abort in-flight on unmount
  React.useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  React.useEffect(() => {
    if (auto && !content[level]) {
      generate(level);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto]);

  const currentText = content[level] || "";

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

  return (
    <div className={["rounded-xl border bg-card p-4", className || ""].join(" ")}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-md bg-accent px-2 py-1 text-xs ring-1 ring-ring">
            <GraduationCap className="h-3.5 w-3.5 text-primary" />
            <span>Explain it to me</span>
          </div>

          {/* Level segmented control */}
          <div className="grid grid-cols-3 overflow-hidden rounded-md border bg-card">
            {(["eli5", "student", "expert"] as Level[]).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLevel(l)}
                className={[
                  "px-3 py-1.5 text-xs transition-colors",
                  level === l
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent",
                ].join(" ")}
                aria-pressed={level === l}
              >
                {l === "eli5" ? "ELI5" : l === "student" ? "Student" : "Expert"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isStreaming ? (
            <Button variant="ghost" size="sm" className="h-8 gap-1.5" onClick={cancel}>
              <StopCircle className="h-4 w-4" />
              Stop
            </Button>
          ) : (
            <>
              <Button
                size="sm"
                className={currentText ? "h-8 gap-1.5" : "btn-primary h-8 gap-1.5"}
                variant={currentText ? "secondary" : "default"}
                onClick={() => generate(level)}
              >
                {currentText ? (
                  <>
                    <RotateCcw className="h-4 w-4" />
                    Regenerate
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Generate
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5"
                onClick={copy}
                disabled={!currentText || isStreaming}
                aria-label="Copy explainer"
              >
                {copied ? (
                  <>
                    <ClipboardCheck className="h-4 w-4" />
                    Copied
                  </>
                ) : (
                  <>
                    <Clipboard className="h-4 w-4" />
                    Copy
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
      <div className="prose prose-invert max-w-none text-sm" aria-live="polite" aria-busy={isStreaming}>
        {status === "error" ? (
          <div className="inline-flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
            <Info className="mt-0.5 h-3.5 w-3.5" />
            <span>{errMsg}</span>
          </div>
        ) : null}

        {!currentText && !isStreaming ? (
          <p className="text-muted-foreground">Pick a level and generate an explainer.</p>
        ) : null}

        <ExplainerText text={currentText} loading={isStreaming} />
      </div>
    </div>
  );
}

/* ========== Subcomponents ========== */

function ExplainerText({ text, loading }: { text: string; loading: boolean }) {
  if (text) {
    const blocks = text
      .split(/\n{2,}/g)
      .map((b) => b.trim())
      .filter(Boolean);

    return (
      <div className="space-y-2 whitespace-pre-wrap">
        {blocks.map((b, i) => (
          <p key={i}>{b}</p>
        ))}
      </div>
    );
  }

  return loading ? <SkeletonLines lines={4} /> : null;
}

function SkeletonLines({ lines = 4 }: { lines?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-3 w-full rounded bg-muted/50" />
      ))}
    </div>
  );
}

/* ========== Stream helpers ========== */

async function readStream(res: Response, onToken: (delta: string) => void): Promise<void> {
  if (!res.body) {
    const t = await safeText(res);
    if (t) onToken(t);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
    if (done) break;

    const events = buffer.split(/\r?\n\r?\n/); // CRLF-safe
    buffer = events.pop() || "";

    for (const ev of events) {
      const dataLines = ev
        .split(/\r?\n/) // CRLF-safe
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
          // treat as plain text if not JSON
        }
        if (!added) onToken(line);
      }
    }
  }

  // Flush any buffered bytes and try to extract text
  buffer += decoder.decode(); // flush
  const tail = buffer.trim();
  if (tail) {
    try {
      const obj = JSON.parse(tail);
      const text = extractDelta(obj);
      if (text) onToken(text);
      else onToken(tail);
    } catch {
      onToken(tail);
    }
  }
}

function extractDelta(obj: any): string | undefined {
  if (typeof obj?.type === "string") {
    if (typeof obj?.delta === "string") return obj.delta;
    if (typeof obj?.delta?.text === "string") return obj.delta.text; // Anthropic-style delta
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