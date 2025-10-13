// app/(app)/paper/[arxivId]/page.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ExternalLink, FileText, Github, Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import PaperBadges from "@/components/papers/paper-badges";
import SummaryStream from "@/components/papers/summary-stream";
import ExplainerPanel from "@/components/papers/explainer-panel";
import ReviewPanel from "@/components/papers/review-panel";
import LeaderboardLinks from "@/components/papers/leaderboard-links";

/* ========== Types ========== */
type Paper = {
  arxivId: string;
  title: string;
  abstract: string;
  authors: string[];
  categories: string[];
  published: string; // ISO
  updated: string; // ISO
  pdfUrl: string | null;

  // Enrichment
  codeUrls?: string[];
  repoStars?: number | null;
  hasWeights?: boolean;

  // Structured
  method?: string | null;
  tasks?: string[];
  datasets?: string[];
  benchmarks?: string[];
  claimedSota?: number; // count
};

/* ========== Mock (deterministic per ID) ========== */
const DEFAULT_CATS = ["cs.AI", "cs.LG", "cs.CL", "cs.CV", "cs.NE", "stat.ML"] as const;
const BASE_NOW = new Date("2025-01-15T12:00:00Z");

const TITLES = [
  "Sparse Mixture-of-Experts for Efficient Long-Context Reasoning",
  "Scaling Laws Revisited: When Tokens Beat Parameters",
  "Distilling Reasoning via Self-Consistency and Sub-Goals",
  "Unified Vision-Language Decoder with Structured Prompts",
  "Retrieval-Free Inference with Synthetic Memory Adapters",
  "SSM Meets Transformers: Hybrid Blocks for Long Sequences",
  "Program-of-Thought with Symbolic Executors",
  "Few-Shot Benchmarks Revisited: A Robustness Study",
  "Tiny Inference, Big Wins: KV-Cache Compression",
  "Multi-Task Pretraining on Code and Math",
  "Continual Learning with Parameter-Efficient Routing",
  "Generalist Agents with Toolformer Adapters",
];

const AUTHORS = [
  ["A. Gupta", "L. Wang", "M. Kim"],
  ["J. Smith", "P. Kumar"],
  ["C. Li", "S. Johnson", "R. Zhao", "E. Chen"],
  ["N. Patel", "D. Brown"],
  ["Y. Tanaka", "H. Park", "V. Ivanov"],
  ["Z. Ahmed", "B. Lee", "K. Ito"],
];

function mockFromId(arxivIdBase: string): Paper {
  const suffix = Number((arxivIdBase.split(".")[1] || "10000").replace(/\D/g, ""));
  const idx = Number.isFinite(suffix) ? Math.max(0, suffix - 10000) : 0;

  const title = TITLES[idx % TITLES.length];
  const authors = AUTHORS[idx % AUTHORS.length];
  const cat = DEFAULT_CATS[idx % DEFAULT_CATS.length];

  const hoursAgo = idx * 6;
  const published = new Date(BASE_NOW.getTime() - hoursAgo * 60 * 60 * 1000);

  // Enrichment
  const hasCode = idx % 2 === 0;
  const repoStars = hasCode ? ((idx * 97) % 1300) + 5 : null;
  const hasWeights = idx % 4 === 0;
  const benchmarks =
    idx % 3 === 0 ? ["MMLU", "GSM8K"] : idx % 3 === 1 ? ["ImageNet-1k"] : [];
  const claimedSota = idx % 10 === 0 ? 1 : 0;

  const abstract =
    "We study a simple approach that improves efficiency without hurting quality. Based only on the title and abstract, results indicate solid performance on common tasks and benchmarks. Code availability is not stated.";

  // Structured (lightly derived)
  const method =
    title.includes("Mixture-of-Experts")
      ? "Sparse Mixture-of-Experts (routing)"
      : title.includes("SSM")
      ? "Hybrid SSM-Transformer block"
      : title.includes("Distilling")
      ? "Distillation with self-consistency"
      : title.includes("Unified Vision-Language")
      ? "Single decoder with structured prompts"
      : title.includes("Program-of-Thought")
      ? "Program-of-Thought with a symbolic executor"
      : "Not stated";

  const tasks =
    benchmarks.includes("MMLU") || benchmarks.includes("GSM8K")
      ? ["Reasoning", "QA"]
      : benchmarks.includes("ImageNet-1k")
      ? ["Image classification"]
      : ["Not stated"];

  const datasets =
    benchmarks.includes("MMLU") || benchmarks.includes("GSM8K")
      ? ["MMLU", "GSM8K"]
      : benchmarks.includes("ImageNet-1k")
      ? ["ImageNet-1k"]
      : [];

  return {
    arxivId: arxivIdBase,
    title,
    abstract,
    authors,
    categories: [cat],
    published: published.toISOString(),
    updated: published.toISOString(),
    pdfUrl: idx % 3 === 0 ? null : `https://arxiv.org/pdf/${arxivIdBase}.pdf`,

    codeUrls: hasCode ? [`https://github.com/ronbun/mock-repo-${suffix}`] : [],
    repoStars,
    hasWeights,

    method,
    tasks,
    datasets,
    benchmarks,
    claimedSota,
  };
}

/* ========== Page ========== */
export default function PaperPage() {
  const params = useParams();
  const raw = String(params?.arxivId || "");
  const baseId = stripVersion(decodeURIComponent(raw));
  const paper = React.useMemo(() => mockFromId(baseId), [baseId]);

  const absUrl = `https://arxiv.org/abs/${baseId}`;
  const pdfUrl = paper.pdfUrl ?? `https://arxiv.org/pdf/${baseId}.pdf`;
  const codeUrl = paper.codeUrls?.[0] || null;

  return (
    <div className="mx-auto w-full max-w-7xl">
      {/* Header: back + actions */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="h-8 px-2">
            <Link href="/feed">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back to Feed
            </Link>
          </Button>
          <span className="text-xs text-muted-foreground">arXiv:{baseId}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm" className="h-8 gap-1.5">
            <Link href={absUrl} target="_blank" rel="noreferrer">
              arXiv
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="h-8 gap-1.5">
            <Link href={pdfUrl} target="_blank" rel="noreferrer">
              PDF
              <FileText className="h-3.5 w-3.5" />
            </Link>
          </Button>
          {codeUrl ? (
            <Button asChild variant="outline" size="sm" className="h-8 gap-1.5">
              <Link href={codeUrl} target="_blank" rel="noreferrer">
                Code
                <Github className="h-3.5 w-3.5" />
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      {/* Title block */}
      <header className="rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{paper.categories[0] || "cs.AI"}</Badge>
          <span className="text-[11px] text-muted-foreground">
            {formatFullDate(paper.published)} • {relativeTime(paper.published)}
          </span>
        </div>
        <h1 className="mt-2 text-xl font-semibold leading-tight tracking-tight">
          {paper.title}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {paper.authors.join(", ")}
        </p>

        {/* Badges (reused) */}
        <PaperBadges paper={paper} className="mt-2" />
      </header>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* Left: main tabs */}
        <section className="min-w-0">
          <Tabs defaultValue="summary" className="w-full">
            <TabsList className="grid grid-cols-4">
              <TabsTrigger value="summary">Summary</TabsTrigger>
              <TabsTrigger value="explainers">Explainers</TabsTrigger>
              <TabsTrigger value="reviewer">Reviewer</TabsTrigger>
              <TabsTrigger value="leaderboards">Leaderboards</TabsTrigger>
            </TabsList>

            {/* Summary (streaming) */}
            <TabsContent value="summary" className="mt-3">
              <SummaryStream title={paper.title} abstract={paper.abstract} />

              {/* Structured fields */}
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <FieldCard label="Method" value={paper.method || "Not stated"} />
                <FieldCard
                  label="Tasks"
                  value={
                    (paper.tasks?.length ?? 0) > 0 ? paper.tasks!.join(", ") : "Not stated"
                  }
                />
                <FieldCard
                  label="Datasets"
                  value={
                    (paper.datasets?.length ?? 0) > 0 ? paper.datasets!.join(", ") : "Not stated"
                  }
                />
                <FieldCard
                  label="Benchmarks"
                  value={
                    (paper.benchmarks?.length ?? 0) > 0 ? paper.benchmarks!.join(", ") : "Not stated"
                  }
                />
              </div>

              {/* Implementation snippet */}
              <div className="mt-3 rounded-xl border bg-card p-4">
                <div className="mb-2 inline-flex items-center gap-2 text-xs text-muted-foreground">
                  <Info className="h-3.5 w-3.5" />
                  <span>Implementation snippet</span>
                </div>
                {codeUrl ? (
                  <pre className="overflow-x-auto rounded-md border bg-background p-3 text-xs leading-relaxed">
{`# Quickstart (mock)
git clone ${codeUrl}
cd $(basename ${codeUrl})
pip install -r requirements.txt

python demo.py --task ${
  paper.benchmarks?.[0] || "demo"
} --device cuda`}
                  </pre>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    No repository linked. Consider checking the arXiv page or Papers with Code for implementations.
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Explainers (reused + seeded) */}
            <TabsContent value="explainers" className="mt-3">
              <ExplainerPanel
                title={paper.title}
                abstract={paper.abstract}
                defaultLevel="eli5"
                initial={{
                  eli5: getExplainer(paper, "eli5"),
                  student: getExplainer(paper, "student"),
                  expert: getExplainer(paper, "expert"),
                }}
                auto={false}
              />
            </TabsContent>

            {/* Reviewer (reused + seeded) */}
            <TabsContent value="reviewer" className="mt-3">
              <ReviewPanel
                title={paper.title}
                abstract={paper.abstract}
                initialReview={getInitialReview(paper)}
                auto={false}
              />
            </TabsContent>

            {/* Leaderboards (reused) */}
            <TabsContent value="leaderboards" className="mt-3">
              <LeaderboardLinks
                arxivId={paper.arxivId}
                title={paper.title}
                hintBenchmarks={paper.benchmarks}
              />
            </TabsContent>
          </Tabs>
        </section>

        {/* Right: details */}
        <aside className="space-y-3">
          <div className="rounded-xl border bg-card p-4">
            <h3 className="text-sm font-medium">Details</h3>
            <div className="mt-2 space-y-2 text-sm">
              <Line label="Published" value={formatFullDate(paper.published)} />
              <Line label="Updated" value={formatFullDate(paper.updated)} />
              <Line
                label="Categories"
                value={
                  <div className="flex flex-wrap gap-1">
                    {paper.categories.map((c) => (
                      <Badge key={c} variant="outline">
                        {c}
                      </Badge>
                    ))}
                  </div>
                }
              />
              <div>
                <div className="text-xs text-muted-foreground">Authors</div>
                <div className="mt-1 text-sm">{paper.authors.join(", ")}</div>
              </div>
            </div>
            <Separator className="my-3 opacity-50" />
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm" className="h-8 gap-1.5">
                <Link href={absUrl} target="_blank" rel="noreferrer">
                  arXiv
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="h-8 gap-1.5">
                <Link href={pdfUrl} target="_blank" rel="noreferrer">
                  PDF
                  <FileText className="h-3.5 w-3.5" />
                </Link>
              </Button>
              {codeUrl ? (
                <Button asChild variant="outline" size="sm" className="h-8 gap-1.5">
                  <Link href={codeUrl} target="_blank" rel="noreferrer">
                    Code
                    <Github className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              ) : null}
            </div>
          </div>

          <div className="rounded-xl border bg-card p-4">
            <h3 className="text-sm font-medium">Disclaimer</h3>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              Summaries, explainers, and reviewer notes are based on the arXiv title and abstract (and README if linked).
              No PDFs or RAG are used in the MVP. Treat all interpretations as provisional.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ========== Subcomponents ========== */

function FieldCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm">{value}</div>
    </div>
  );
}

function Line({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5">{value}</div>
    </div>
  );
}

/* ========== Seed helpers for panels (mock) ========== */

function getExplainer(p: Paper, level: "eli5" | "student" | "expert") {
  const base =
    p.method && p.method !== "Not stated" ? p.method : "the method in this paper";
  if (level === "eli5") {
    return `Think of ${base} as a simple trick that helps the model focus on the right pieces at the right time, so it thinks faster without getting confused.`;
  }
  if (level === "student") {
    return `${base} balances efficiency and quality by selecting or structuring computation more intelligently. On tasks like ${
      (p.tasks?.[0] as string) || "reasoning"
    }, it aims to keep performance competitive while reducing overhead.`;
  }
  return `The paper proposes ${base}, targeting ${
    (p.tasks?.join(", ") as string) || "general tasks"
  }. Evaluation references ${
    (p.benchmarks?.join(", ") as string) || "standard benchmarks"
  }, with claims grounded in title/abstract only. Implementation details and compute budget are not fully specified.`;
}

function getInitialReview(p: Paper) {
  // Shape matches ReviewPanel's ReviewJSON
  const strengths = [
    "Clear motivation for efficiency/quality trade-off",
    p.codeUrls?.length ? "Public code link provided" : "Simple design, easy to reason about",
    (p.benchmarks?.length ?? 0) > 0 ? "Evaluates on common benchmarks" : "Positioned for practical use",
  ];
  const weaknesses = [
    (p.claimedSota ?? 0) > 0 ? "SOTA claim may require stronger evidence" : "No explicit SOTA claims",
    p.hasWeights ? "Weights present but training details unclear" : "No released weights",
  ];
  const risks = ["Overfitting to narrow benchmarks", "Compute/resource requirements under-specified"];
  const next_experiments = [
    "Ablate components and routing choices",
    "Evaluate on out-of-domain robustness",
    "Add detailed compute and reproducibility appendix",
  ];

  return {
    strengths,
    weaknesses,
    risks,
    next_experiments,
    reproducibility_notes: p.codeUrls?.length
      ? "Setup should be reproducible with the provided repo."
      : "Not stated",
    novelty_score: 2,
    clarity_score: 2,
    caveats: null,
  };
}

/* ========== Utils ========== */

function stripVersion(arxivId: string) {
  return arxivId.replace(/v\d+$/i, "");
}

function relativeTime(iso: string) {
  const d = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - d);
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d2 = Math.floor(h / 24);
  if (d2 < 7) return `${d2}d ago`;
  const w = Math.floor(d2 / 7);
  return `${w}w ago`;
}

function formatFullDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}