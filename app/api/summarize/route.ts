/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { groq } from "@ai-sdk/groq";
import { streamText } from "ai";
import { SummarizeInput } from "@/lib/zod";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const DEFAULT_MODEL =
  process.env.GROQ_SUMMARIZE_MODEL || process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
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

    const run = async (withTier: boolean) => {
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
          {
            role: "user",
            content: `Title: ${title}\n\nAbstract:\n${abstract}`,
          },
        ],
      });
    };

    try {
      // First attempt: only include tier if provided via env or query
      const result = await run(Boolean(effectiveTier));
      return result.toTextStreamResponse();
    } catch (e: any) {
      const msg: string =
        e?.data?.error?.message || e?.message || e?.toString?.() || "";
      // If Groq rejects the tier, retry once without any tier
      if (msg.includes("service_tier")) {
        const result = await run(false);
        return result.toTextStreamResponse();
      }
      throw e;
    }
  } catch (err: any) {
    return json({ error: err?.message || "Failed to summarize" }, 500);
  }
}

function json(body: unknown, status = 200, headers?: Record<string, string>) {
  return new NextResponse(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...(headers || {}) },
  });
}