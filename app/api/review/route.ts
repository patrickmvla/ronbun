/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/review/route.ts
import { NextResponse } from "next/server";
import { groq } from "@ai-sdk/groq";
import { generateObject, generateText } from "ai";
import { ReviewInput, ReviewLLM } from "@/lib/zod";

export const runtime = "edge";
export const dynamic = "force-dynamic";

// Default to a model that supports json_schema per Groq docs
const DEFAULT_MODEL =
  process.env.GROQ_REVIEW_MODEL ||
  process.env.GROQ_MODEL ||
  "meta-llama/llama-4-maverick-17b-128e-instruct";

const ENV_TIER = process.env.GROQ_SERVICE_TIER?.trim(); // e.g., "on_demand"; unset to omit

// Simple supported set (from Groq docs)
const STRUCTURED_SUPPORTED = new Set<string>([
  "openai/gpt-oss-20b",
  "openai/gpt-oss-120b",
  "moonshotai/kimi-k2-instruct-0905",
  "meta-llama/llama-4-maverick-17b-128e-instruct",
  "meta-llama/llama-4-scout-17b-16e-instruct",
]);

export async function POST(req: Request) {
  try {
    if (!process.env.GROQ_API_KEY) {
      return json({ error: "GROQ_API_KEY is not set" }, 500);
    }

    const url = new URL(req.url);
    const modelId = url.searchParams.get("model") || DEFAULT_MODEL;

    // Optional: ?tier=on_demand or ?tier=none
    const tierParam = url.searchParams.get("tier")?.trim();
    const effectiveTier =
      tierParam && tierParam.toLowerCase() !== "none" ? tierParam : ENV_TIER;

    const body = await req.json();
    const parsed = ReviewInput.safeParse(body);
    if (!parsed.success) {
      return json(
        { error: "Invalid input", issues: parsed.error.flatten() },
        400
      );
    }

    const { title, abstract, readme } = parsed.data;

    const userContent =
      [
        `Title: ${title}`,
        "",
        "Abstract:",
        abstract,
        "",
        readme ? `README (optional):\n${readme}` : "",
      ]
        .filter(Boolean)
        .join("\n") || "";

    // Structured (json_schema)
    const callStructured = async () => {
      const { object } = await generateObject({
        model: groq(modelId),
        temperature: 0.2,
        maxOutputTokens: 1200,
        ...(effectiveTier
          ? { providerOptions: { groq: { structuredOutputs: true, serviceTier: effectiveTier } } }
          : { providerOptions: { groq: { structuredOutputs: true } } }),
        schema: ReviewLLM,
        messages: [
          {
            role: "system",
            content: [
              "Act as a careful reviewer. Base your review ONLY on the provided title and abstract (and README if present).",
              "Return a JSON object matching the provided schema exactly.",
              "Rules:",
              '- If a detail is missing, set the field to "Not stated" (or null where applicable).',
              "- Do NOT speculate or add external information.",
              "- Do NOT assert SOTA unless the abstract explicitly claims it.",
              "- novelty_score and clarity_score must be integers 0..3 or null if not inferable.",
              "Keep bullets concise and concrete.",
            ].join("\n"),
          },
          { role: "user", content: userContent },
        ],
      });
      return object;
    };

    // JSON Object Mode + Zod validation
    const callJsonObject = async () => {
      const { text } = await generateText({
        model: groq(modelId),
        temperature: 0.2,
        maxOutputTokens: 1200,
        ...(effectiveTier ? { providerOptions: { groq: { serviceTier: effectiveTier } } } : {}),
        providerOptions: {
          groq: { responseFormat: { type: "json_object" } },
        },
        messages: [
          {
            role: "system",
            content: [
              "Act as a careful reviewer. Base your review ONLY on the provided title and abstract (and README if present).",
              "Respond ONLY with JSON using exactly these keys:",
              `{
  "strengths": string[],
  "weaknesses": string[],
  "risks": string[],
  "next_experiments": string[],
  "reproducibility_notes": string | null,
  "novelty_score": 0|1|2|3|null,
  "clarity_score": 0|1|2|3|null,
  "caveats": string | null
}`,
              'No prose outside the JSON. If a detail is missing, use "Not stated" (or null where applicable).',
            ].join("\n"),
          },
          { role: "user", content: userContent },
        ],
      });

      const payload = safeParseJson(extractJson(text));
      const validated = ReviewLLM.safeParse(payload);
      if (validated.success) return validated.data;
      return coerceReview(payload);
    };

    // Rate-limit aware runner
    const runWithRateLimit = async <T,>(
      fn: () => Promise<T>,
      opts?: { attempts?: number; baseDelayMs?: number }
    ): Promise<T> => {
      const attempts = Math.max(1, opts?.attempts ?? 3);
      const base = Math.max(250, opts?.baseDelayMs ?? 750);

      let lastErr: any = null;
      for (let i = 0; i < attempts; i++) {
        try {
          return await fn();
        } catch (e: any) {
          lastErr = e;
          const status = e?.statusCode ?? e?.status;
          const headers = e?.responseHeaders || {};
          // Rate limit: 429 with retry-after
          if (status === 429) {
            const ra = parseRetryAfter(headers["retry-after"]);
            const wait = ra ?? jitter(base * Math.pow(2, i));
            await sleep(wait);
            continue;
          }
          // Transient server errors (simple backoff)
          if (status === 500 || status === 502 || status === 503 || status === 504) {
            await sleep(jitter(base * Math.pow(2, i)));
            continue;
          }
          // Non-retryable → break
          break;
        }
      }
      throw lastErr;
    };

    let object: any;
    if (STRUCTURED_SUPPORTED.has(modelId)) {
      try {
        object = await runWithRateLimit(() => callStructured());
      } catch (e: any) {
        const msg =
          e?.data?.error?.message ||
          e?.message ||
          e?.toString?.() ||
          "";
        // If model doesn't support json_schema/response_format, fallback to JSON Object Mode
        if (
          msg.includes("json_schema") ||
          msg.includes("response format") ||
          msg.includes("does not support response format")
        ) {
          object = await runWithRateLimit(() => callJsonObject());
        } else {
          throw e;
        }
      }
    } else {
      object = await runWithRateLimit(() => callJsonObject());
    }

    return json(object, 200, { "Cache-Control": "no-store" });
  } catch (err: any) {
    return json({ error: err?.message || "Failed to generate review" }, 500);
  }
}

/* ========== Helpers ========== */

function extractJson(s: string): string {
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    return s.slice(start, end + 1);
  }
  return s.trim();
}

function safeParseJson(s: string): any {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function coerceReview(x: any) {
  const toArr = (v: unknown): string[] =>
    Array.isArray(v)
      ? v
          .map((s) => (typeof s === "string" ? s : String(s)))
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
      : [];

  const toInt = (v: unknown): number | null => {
    if (v === null || v === undefined) return null;
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(0, Math.min(3, Math.round(n))) : null;
  };

  const toStr = (v: unknown): string | null =>
    typeof v === "string" && v.trim().length > 0 ? v : null;

  return {
    strengths: toArr(x?.strengths),
    weaknesses: toArr(x?.weaknesses),
    risks: toArr(x?.risks),
    next_experiments: toArr(x?.next_experiments),
    reproducibility_notes: toStr(x?.reproducibility_notes) ?? null,
    novelty_score: toInt(x?.novelty_score),
    clarity_score: toInt(x?.clarity_score),
    caveats: toStr(x?.caveats) ?? null,
  };
}

function parseRetryAfter(v: any): number | null {
  if (!v) return null;
  // Usually seconds per Groq docs; support integer seconds
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
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...(headers || {}),
    },
  });
}