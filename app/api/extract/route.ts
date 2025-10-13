import { NextResponse } from "next/server";
import { groq } from "@ai-sdk/groq";
import { generateObject } from "ai";
import { ExtractInput, ExtractedLLM } from "@/lib/zod";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const DEFAULT_MODEL = process.env.GROQ_EXTRACT_MODEL || "llama-3.3-70b-versatile";

export async function POST(req: Request) {
  try {
    if (!process.env.GROQ_API_KEY) {
      return json({ error: "GROQ_API_KEY is not set" }, 500);
    }

    const body = await req.json();
    const parsed = ExtractInput.safeParse(body);
    if (!parsed.success) {
      return json({ error: "Invalid input", issues: parsed.error.flatten() }, 400);
    }

    const { title, abstract } = parsed.data;

    const { object } = await generateObject({
      model: groq(DEFAULT_MODEL),
      temperature: 0.1,
      maxOutputTokens: 900, // v5
      providerOptions: {
        groq: {
          structuredOutputs: true,
          serviceTier: "flex",
        },
      },
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
        {
          role: "user",
          content: `Title: ${title}\n\nAbstract:\n${abstract}`,
        },
      ],
    });

    return json(object, 200, { "Cache-Control": "no-store" });
  } catch (err: any) {
    return json({ error: err?.message || "Failed to extract fields" }, 500);
  }
}

function json(body: unknown, status = 200, headers?: Record<string, string>) {
  return new NextResponse(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...(headers || {}) },
  });
}