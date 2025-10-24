/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/explain/route.ts
import { NextResponse } from "next/server";
import { groq } from "@ai-sdk/groq";
import { streamText } from "ai";
import { ExplainInput } from "@/lib/zod";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const DEFAULT_MODEL =
  process.env.GROQ_EXPLAIN_MODEL ||
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
    const parsed = ExplainInput.safeParse(body);
    if (!parsed.success) {
      return json(
        { error: "Invalid input", issues: parsed.error.flatten() },
        400
      );
    }

    const { title, abstract, level, readme } = parsed.data;

    // IMPORTANT: make this a mutable array (no "as const")
    const messages: { role: "system" | "user"; content: string }[] = [
      { role: "system", content: buildSystemPrompt(level) },
      {
        role: "user",
        content:
          [
            `Level: ${level}`,
            `Title: ${title}`,
            "",
            "Abstract:",
            abstract,
            "",
            readme ? `README (optional):\n${readme}` : "",
          ]
            .filter(Boolean)
            .join("\n") || "",
      },
    ];

    // one streaming attempt
    const runOnce = async (withTier: boolean) => {
      return await streamText({
        model: groq(modelId),
        temperature: 0.2,
        maxOutputTokens: 1200,
        ...(withTier && effectiveTier
          ? { providerOptions: { groq: { serviceTier: effectiveTier } } }
          : {}),
        messages, // now mutable type
      });
    };

    // retry handler with backoff + retry-after for 429/5xx
    const runWithRateLimit = async (withTier: boolean) => {
      const attempts = 3;
      const base = 750; // ms

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

          // 429 → respect retry-after, else exponential backoff with jitter
          if (status === 429) {
            const ra = parseRetryAfter(headers["retry-after"]);
            const wait = ra ?? jitter(base * Math.pow(2, i));
            await sleep(wait);
            continue;
          }

          // transient 5xx → backoff
          if (status === 500 || status === 502 || status === 503 || status === 504) {
            await sleep(jitter(base * Math.pow(2, i)));
            continue;
          }

          // service tier rejection: bubble up so we can retry without tier once
          if (msg.includes("service_tier")) {
            throw e;
          }

          // non-retryable
          break;
        }
      }
      throw lastErr;
    };

    try {
      const result = await runWithRateLimit(Boolean(effectiveTier));
      return result.toTextStreamResponse();
    } catch (e: any) {
      const msg: string =
        e?.data?.error?.message || e?.message || e?.toString?.() || "";
      // If Groq rejects the tier, retry once without any tier (also rate-limit aware)
      if (msg.includes("service_tier")) {
        const result = await runWithRateLimit(false);
        return result.toTextStreamResponse();
      }
      throw e;
    }
  } catch (err: any) {
    return json({ error: err?.message || "Failed to generate explainer" }, 500);
  }
}

function buildSystemPrompt(level: "eli5" | "student" | "expert") {
  const common = [
    "Explain ONLY from the provided title, abstract, and optional README.",
    'If a detail is missing, write "Not stated".',
    "Do not speculate or add external information. Do not assert SOTA unless explicitly stated.",
    "Structure the output into short sections separated by blank lines.",
  ];
  if (level === "eli5") {
    return [
      ...common,
      "Audience: a curious non-expert (ELI5).",
      "Style: friendly, concrete, minimal jargon; use simple analogies when helpful.",
      "Format:",
      "What it is: <2–3 sentences>",
      "How it works: <2–4 short sentences>",
      "Why it matters / Examples: <1–3 sentences>",
      "Limits: <1–2 sentences>",
    ].join("\n");
  }
  if (level === "student") {
    return [
      ...common,
      "Audience: undergrad/grad student.",
      "Style: concise, structured, clear terminology.",
      "Format (use brief subsections):",
      "Overview: <2–3 sentences>",
      "Method: <key idea + main steps/components>",
      "Evidence: <datasets/benchmarks/claims if stated>",
      "Limitations: <risks, assumptions, or missing pieces>",
    ].join("\n");
  }
  return [
    ...common,
    "Audience: expert reader.",
    "Style: terse and technical. Prefer specifics over analogies.",
    "Format (bulleted where natural):",
    "- Problem/Setup",
    "- Approach/Architecture (modules, objectives, training/inference notes)",
    "- Evaluation (datasets/benchmarks/claims) — only if stated",
    "- Limitations/Caveats",
  ].join("\n");
}

/* ========== Helpers ========== */

function parseRetryAfter(v: any): number | null {
  if (!v) return null;
  // Groq docs: retry-after in seconds on 429
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