/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/summarize/route.ts
import { NextResponse } from "next/server";
import { groq } from "@ai-sdk/groq";
import { streamText } from "ai";
import { SummarizeInput } from "@/lib/zod";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const DEFAULT_MODEL =
  process.env.GROQ_SUMMARIZE_MODEL ||
  process.env.GROQ_MODEL ||
  "llama-3.3-70b-versatile"; // keep your current default; override via env if desired

const ENV_TIER = process.env.GROQ_SERVICE_TIER?.trim(); // e.g., "on_demand"; leave unset to omit

export async function POST(req: Request) {
  try {
    if (!process.env.GROQ_API_KEY) {
      return json({ error: "GROQ_API_KEY is not set" }, 500);
    }

    const url = new URL(req.url);
    const modelId = url.searchParams.get("model") || DEFAULT_MODEL;

    // Optional: allow ?tier=on_demand or ?tier=none
    const tierParam = url.searchParams.get("tier")?.trim();
    const effectiveTier =
      tierParam && tierParam.toLowerCase() !== "none" ? tierParam : ENV_TIER;

    const body = await req.json();
    const parsed = SummarizeInput.safeParse(body);
    if (!parsed.success) {
      return json({ error: "Invalid input", issues: parsed.error.flatten() }, 400);
    }

    const { title, abstract } = parsed.data;

    // One attempt of streaming request
    const runOnce = async (withTier: boolean) => {
      return await streamText({
        model: groq(modelId),
        temperature: 0.1,
        maxOutputTokens: 512,
        ...(withTier && effectiveTier
          ? { providerOptions: { groq: { serviceTier: effectiveTier } } }
          : {}),
        messages: [
          {
            role: "system",
            content: [
              "You are a precise summarizer. Summarize ONLY from the provided title and abstract.",
              "Output format:",
              "Takeaway: <single sentence>",
              "- Contributions: <short bullet>",
              "- Method: <short bullet>",
              "- Tasks/Datasets: <short bullet>",
              "- Results/Claims: <short bullet>",
              "Rules:",
              '- If a detail is missing, output "Not stated".',
              "- Do NOT infer or speculate beyond the text.",
              "- Do NOT assert SOTA unless explicitly stated.",
            ].join("\n"),
          },
          { role: "user", content: `Title: ${title}\n\nAbstract:\n${abstract}` },
        ],
      });
    };

    // Rate-limit aware runner with exponential backoff + retry-after
    const runWithRateLimit = async (withTier: boolean) => {
      const attempts = 3;
      const base = 750; // ms backoff base

      let lastErr: any = null;
      for (let i = 0; i < attempts; i++) {
        try {
          return await runOnce(withTier);
        } catch (e: any) {
          lastErr = e;
          const status = e?.statusCode ?? e?.status;
          const headers = e?.responseHeaders || {};
          const msg =
            e?.data?.error?.message || e?.message || e?.toString?.() || "";

          // 429 rate limit: respect retry-after (seconds), else exponential backoff with jitter
          if (status === 429) {
            const ra = parseRetryAfter(headers["retry-after"]);
            const wait = ra ?? jitter(base * Math.pow(2, i));
            await sleep(wait);
            continue;
          }

          // Transient 5xx → backoff and retry
          if (status === 500 || status === 502 || status === 503 || status === 504) {
            await sleep(jitter(base * Math.pow(2, i)));
            continue;
          }

          // If it's a service tier error, bubble up; we'll try without tier once outside
          if (msg.includes("service_tier")) {
            throw e;
          }

          // Non-retryable → stop
          break;
        }
      }
      throw lastErr;
    };

    try {
      // First: include tier only if provided (env/query). Backoff on 429/5xx.
      const result = await runWithRateLimit(Boolean(effectiveTier));
      return result.toTextStreamResponse();
    } catch (e: any) {
      const msg: string =
        e?.data?.error?.message || e?.message || e?.toString?.() || "";

      // If Groq rejects the tier, retry the whole request once without any tier (also rate-limit aware)
      if (msg.includes("service_tier")) {
        const result = await runWithRateLimit(false);
        return result.toTextStreamResponse();
      }
      throw e;
    }
  } catch (err: any) {
    return json({ error: err?.message || "Failed to summarize" }, 500);
  }
}

/* ========== Helpers ========== */

function parseRetryAfter(v: any): number | null {
  if (!v) return null;
  // Groq docs: retry-after is in seconds when 429 is returned
  const n = Number(String(v).trim());
  return Number.isFinite(n) ? Math.max(0, Math.floor(n * 1000)) : null;
}

function jitter(ms: number): number {
  const d = Math.floor(ms * 0.2);
  return ms + Math.floor(Math.random() * d) - Math.floor(d / 2);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function json(body: unknown, status = 200, headers?: Record<string, string>) {
  return new NextResponse(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...(headers || {}) },
  });
}