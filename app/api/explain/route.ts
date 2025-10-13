import { NextResponse } from "next/server";
import { groq } from "@ai-sdk/groq";
import { streamText } from "ai";
import { ExplainInput } from "@/lib/zod";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const DEFAULT_MODEL = process.env.GROQ_EXPLAIN_MODEL || "llama-3.3-70b-versatile";

export async function POST(req: Request) {
  try {
    if (!process.env.GROQ_API_KEY) {
      return json({ error: "GROQ_API_KEY is not set" }, 500);
    }

    const url = new URL(req.url);
    const modelId = url.searchParams.get("model") || DEFAULT_MODEL;

    const body = await req.json();
    const parsed = ExplainInput.safeParse(body);
    if (!parsed.success) {
      return json({ error: "Invalid input", issues: parsed.error.flatten() }, 400);
    }

    const { title, abstract, level, readme } = parsed.data;

    const result = await streamText({
      model: groq(modelId),
      temperature: 0.2,
      maxOutputTokens: 1200, // v5
      providerOptions: { groq: { serviceTier: "flex" } },
      messages: [
        { role: "system", content: buildSystemPrompt(level) },
        {
          role: "user",
          content: [
            `Level: ${level}`,
            `Title: ${title}`,
            "",
            "Abstract:",
            abstract,
            "",
            readme ? `README (optional):\n${readme}` : "",
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
    });

    return result.toTextStreamResponse();
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

function json(body: unknown, status = 200, headers?: Record<string, string>) {
  return new NextResponse(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...(headers || {}) },
  });
}