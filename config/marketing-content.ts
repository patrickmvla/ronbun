import { FaqItemProps, FeatureTileProps, PersonaTileProps, StatProps, TimelineStepProps } from "@/types/marketing";

export const HERO_STATS: Omit<StatProps, 'icon'>[] = [
  {
    label: "Hourly refresh",
    ariaLabel: "Papers refreshed every hour",
  },
  {
    label: "6 core arXiv areas",
    ariaLabel: "Covers 6 core arXiv research areas",
  },
  {
    label: "No PDFs. No RAG.",
    ariaLabel: "No PDF parsing or RAG required",
  },
];

export const FEATURES: Omit<FeatureTileProps, 'icon'>[] = [
  {
    title: "Fast, grounded summaries",
    description: "1‑liner and bullets from title + abstract only. Streamed for instant scan.",
    href: "/feed",
  },
  {
    title: "Explain at your level",
    description: "ELI5, Student, and Expert explainers—switch depth without losing clarity.",
    href: "/feed",
  },
  {
    title: "Reviewer mode",
    description: "Strengths, weaknesses, risks, and next experiments—no speculation.",
    href: "/feed",
  },
  {
    title: "Leaderboards",
    description: "Auto‑link Papers with Code tasks/benchmarks mentioned in abstracts.",
    href: "/feed",
  },
  {
    title: "Watchlists & digests",
    description: "Follow authors, topics, benchmarks; get a personal feed and weekly email.",
    href: "/feed",
  },
  {
    title: "Implementation‑ready",
    description: "Code badges, repo metadata, and quickstarts when repos are linked.",
    href: "/feed",
  },
];

export const TIMELINE_STEPS: TimelineStepProps[] = [
  {
    number: "01",
    title: "Ingest arXiv",
    bullets: ["Hourly pulls", "cs.AI, cs.LG, cs.CL", "cs.CV, cs.NE, stat.ML"],
  },
  {
    number: "02",
    title: "Enrich & extract",
    bullets: ["Detect GitHub links", "Method, tasks, datasets", "Benchmarks & claims"],
  },
  {
    number: "03",
    title: "Personalize",
    bullets: ["Momentum ranking", "Watchlist boosts", "Weekly digests"],
  },
];

export const PERSONAS: Omit<PersonaTileProps, 'icon'>[] = [
  {
    title: "Grad students",
    points: ["Follow advisor, group, and topic", "Skim fast; queue to read later"],
    chips: ["Personal feed", "Queue to read"],
  },
  {
    title: "Researchers",
    points: ["Track subfields and benchmarks", "Compare papers; spot SOTA claims"],
    chips: ["Watchlists", "Compare"],
  },
  {
    title: "Builders",
    points: ["Jump to repos and quickstarts", "See tasks/datasets at a glance"],
    chips: ["Repos", "Quickstart"],
  },
];

export const FAQS: FaqItemProps[] = [
  {
    question: "Do I need API keys to use Ronbun?",
    answer: "No. arXiv is keyless. GitHub auth is optional for sign‑in.",
  },
  {
    question: "Does Ronbun parse PDFs or use RAG?",
    answer: "Not in the MVP. We ground everything on title + abstract (and README if available).",
  },
  {
    question: "Which areas are covered?",
    answer: "cs.AI, cs.LG, cs.CL, cs.CV, cs.NE, stat.ML—expanding over time.",
  },
  {
    question: "Can I track authors and benchmarks?",
    answer: "Yes. Create watchlists for keywords, authors, and benchmarks to personalize your feed.",
  },
];

export const FEATURE_HIGHLIGHT = {
  badge: {
    label: "New",
    description: "Momentum score + PwC links",
  },
  title: "Stay in the loop, minus the noise",
  description:
    "Ronbun ranks what matters: recency, code presence, and your watchlists. See SOTA claims, tasks, and datasets at a glance—then jump straight to repos.",
  chips: ["Personal feeds", "Watchlists", "Momentum ranking", "Papers with Code"],
  cta: {
    text: "Explore the Feed",
    href: "/feed",
  },
};