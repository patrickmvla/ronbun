/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/extract/route.ts
import { NextResponse } from "next/server";
import { groq } from "@ai-sdk/groq";
import { generateObject } from "ai";
import { ExtractInput, ExtractedLLM } from "@/lib/zod";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const DEFAULT_MODEL =
  process.env.GROQ_EXTRACT_MODEL ||
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

    // Optional: allow ?tier=on_demand or ?tier=none to override/omit
    const tierParam = url.searchParams.get("tier")?.trim();
    const effectiveTier =
      tierParam && tierParam.toLowerCase() !== "none" ? tierParam : ENV_TIER;

    const body = await req.json();
    const parsed = ExtractInput.safeParse(body);
    if (!parsed.success) {
      return json({ error: "Invalid input", issues: parsed.error.flatten() }, 400);
    }

    const { title, abstract } = parsed.data;

    // Single attempt of structured outputs request
    const runOnce = async (withTier: boolean) => {
      return await generateObject({
        model: groq(modelId),
        temperature: 0.1,
        maxOutputTokens: 900,
        ...(withTier && effectiveTier
          ? { providerOptions: { groq: { structuredOutputs: true, serviceTier: effectiveTier } } }
          : { providerOptions: { groq: { structuredOutputs: true } } }),
        schema: ExtractedLLM,
        messages: [
          {
            role: "system",
            content: [
              "Extract ONLY from the provided title and abstract. Do not speculate.",
              "Return fields using the exact JSON schema.",
              "- method: short name/phrase; null if not stated.",
              "- tasks: array of task names (e.g., 'Reasoning', 'Image classification').",
              "- datasets: array of datasets (e.g., 'MMLU', 'ImageNet-1k').",
              "- benchmarks: array of benchmarks/tasks commonly used for SOTA (e.g., 'MMLU', 'GSM8K').",
              "- claimed_sota: list entries ONLY if the abstract explicitly claims state-of-the-art; otherwise empty.",
              "- params/tokens: numeric (billions) if explicitly stated; otherwise null.",
              "- compute: short free-text if stated; else null.",
              "- code_urls: include only URLs explicitly present in the abstract; otherwise empty.",
              "Never infer numbers or SOTA claims if not explicit.",
            ].join("\n"),
          },
          { role: "user", content: `Title: ${title}\n\nAbstract:\n${abstract}` },
        ],
      });
    };

    // Rate-limit aware wrapper with retry-after and backoff for 429/5xx
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

          // 429 Too Many Requests → respect retry-after (seconds)
          if (status === 429) {
            const ra = parseRetryAfter(headers["retry-after"]);
            const wait = ra ?? jitter(base * Math.pow(2, i));
            await sleep(wait);
            continue;
          }

          // Transient 5xx → exponential backoff + jitter
          if (status === 500 || status === 502 || status === 503 || status === 504) {
            await sleep(jitter(base * Math.pow(2, i)));
            continue;
          }

          // service tier rejection handled outside (retry without tier once)
          if (msg.includes("service_tier")) {
            throw e;
          }

          // Non-retryable → break
          break;
        }
      }
      throw lastErr;
    };

    try {
      // First attempt: include tier only if provided via env/query
      const { object } = await runWithRateLimit(Boolean(effectiveTier));
      return json(object, 200, { "Cache-Control": "no-store" });
    } catch (e: any) {
      const msg: string =
        e?.data?.error?.message || e?.message || e?.toString?.() || "";
      // If Groq rejects the tier, retry once without any tier (also rate-limit aware)
      if (msg.includes("service_tier")) {
        const { object } = await runWithRateLimit(false);
        return json(object, 200, { "Cache-Control": "no-store" });
      }
      throw e;
    }
  } catch (err: any) {
    return json({ error: err?.message || "Failed to extract fields" }, 500);
  }
}

/* ========== Helpers ========== */

function parseRetryAfter(v: any): number | null {
  if (!v) return null;
  // Groq docs: retry-after is seconds when 429 is returned
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