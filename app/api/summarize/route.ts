/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { groq } from "@ai-sdk/groq";
import { streamText } from "ai";
import { SummarizeInput } from "@/lib/zod";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const DEFAULT_MODEL = process.env.GROQ_SUMMARIZE_MODEL || "llama-3.3-70b-versatile";

export async function POST(req: Request) {
  try {
    if (!process.env.GROQ_API_KEY) {
      return json({ error: "GROQ_API_KEY is not set" }, 500);
    }

    const url = new URL(req.url);
    const modelId = url.searchParams.get("model") || DEFAULT_MODEL;

    const body = await req.json();
    const parsed = SummarizeInput.safeParse(body);
    if (!parsed.success) {
      return json({ error: "Invalid input", issues: parsed.error.flatten() }, 400);
    }

    const { title, abstract } = parsed.data;

    const result = await streamText({
      model: groq(modelId),
      temperature: 0.1,
      maxOutputTokens: 512, // v5
      providerOptions: {
        groq: { serviceTier: "flex" },
      },
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
            'Rules:',
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

    return result.toTextStreamResponse();
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