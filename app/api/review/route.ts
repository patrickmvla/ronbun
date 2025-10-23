/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/review/route.ts
import { NextResponse } from "next/server";
import { groq } from "@ai-sdk/groq";
import { generateObject } from "ai";
import { ReviewInput, ReviewLLM } from "@/lib/zod";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const DEFAULT_MODEL =
  process.env.GROQ_REVIEW_MODEL ||
  process.env.GROQ_MODEL ||
  "llama-3.3-70b-versatile";
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
    const parsed = ReviewInput.safeParse(body);
    if (!parsed.success) {
      return json(
        { error: "Invalid input", issues: parsed.error.flatten() },
        400
      );
    }

    const { title, abstract, readme } = parsed.data;

    const run = async (withTier: boolean) => {
      return await generateObject({
        model: groq(modelId),
        temperature: 0.2,
        maxOutputTokens: 1200,
        ...(withTier && effectiveTier
          ? {
              providerOptions: {
                groq: { structuredOutputs: true, serviceTier: effectiveTier },
              },
            }
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
          {
            role: "user",
            content:
              [
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
        ],
      });
    };

    try {
      // First attempt: only include tier if provided via env or query
      const { object } = await run(Boolean(effectiveTier));
      return json(object, 200, { "Cache-Control": "no-store" });
    } catch (e: any) {
      const msg: string =
        e?.data?.error?.message || e?.message || e?.toString?.() || "";
      // If Groq rejects the tier, retry once without any tier
      if (msg.includes("service_tier")) {
        const { object } = await run(false);
        return json(object, 200, { "Cache-Control": "no-store" });
      }
      throw e;
    }
  } catch (err: any) {
    return json({ error: err?.message || "Failed to generate review" }, 500);
  }
}

/* ========== Helpers ========== */
function json(body: unknown, status = 200, headers?: Record<string, string>) {
  return new NextResponse(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...(headers || {}),
    },
  });
}