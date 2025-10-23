// app/(marketing)/page.tsx
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  ArrowRight,
  Ban,
  Beaker,
  Clock,
  Code,
  GitCompare,
  GraduationCap,
  Layers,
  LayoutGrid,
  ListChecks,
  Trophy,
  Zap,
} from "lucide-react";
import Link from "next/link";

import { FaqItem } from "@/components/marketing/faq-item";
import { FeatureHighlight } from "@/components/marketing/feature-highlight";
import { FeatureTile } from "@/components/marketing/feature-tile";
import { PersonaTile } from "@/components/marketing/persona-tile";
import { Stat } from "@/components/marketing/stat";
import { TimelineStep } from "@/components/marketing/timeline-step";
import { FAQS, FEATURES, PERSONAS, TIMELINE_STEPS } from "@/config/marketing-content";

import { getAuth } from "@/lib/auth";
// If you prefer auto-redirect signed-in users to /feed, uncomment:
// import { redirect } from "next/navigation";

export default async function MarketingPage() {
  const { user } = await getAuth();
  const authed = Boolean(user);

  // If you want to auto-launch the app when signed in, uncomment:
  // if (authed) redirect("/feed");

  return (
    <div className="relative overflow-x-hidden">
      {/* Skip to main content link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md"
      >
        Skip to main content
      </a>

      {/* Decorative brand halo */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
        <div
          className="absolute left-1/2 top-[-18%] h-[44vh] w-[100vw] -translate-x-1/2 rounded-full blur-3xl opacity-70"
          style={{
            background:
              "radial-gradient(60% 60% at 50% 50%, color-mix(in oklch, var(--primary) 16%, transparent) 0%, transparent 70%)",
          }}
        />
      </div>

      {/* Hero Section */}
      <section
        id="main-content"
        className="mx-auto max-w-6xl px-4 md:px-6 pt-16 pb-12 text-center"
        aria-labelledby="hero-title"
      >
        <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-muted-foreground">
          <Badge className="bg-primary text-primary-foreground">beta</Badge>
          <span>Dark-only • Groq-powered • arXiv-native</span>
        </div>

        <h1 id="hero-title" className="mt-6 text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight">
          Ronbun{" "}
          <span
            lang="ja"
            className="align-baseline text-muted-foreground text-2xl sm:text-3xl md:text-4xl"
            aria-label="論文, Japanese for paper or thesis"
          >
            (ロンブン)
          </span>
        </h1>

        <p className="mt-3 text-2xl sm:text-3xl md:text-4xl font-semibold text-primary">
          Your fast lane to AI/ML papers
        </p>

        <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
          Personal feeds for subfields and authors. Lightning summaries, multi‑level explainers,
          reviewer mode, and leaderboard links—grounded in arXiv title + abstract.
        </p>

        <div className="mt-8 flex items-center justify-center gap-3">
          {/* If signed in: show single CTA to feed. If not: show Launch + Sign in */}
          {authed ? (
            <Button asChild className="btn-primary gap-2">
              <Link href="/feed" prefetch>
                Go to feed
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          ) : (
            <>
              <Button asChild className="btn-primary gap-2">
                <Link href="/feed" prefetch>
                  Launch app
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              {/* <Button asChild variant="secondary" className="hover:bg-accent">
                <Link href="/auth/sign-in">Sign in</Link>
              </Button> */}
            </>
          )}
        </div>

        {/* Stats */}
        <div
          className="mx-auto mt-8 grid w-full max-w-3xl grid-cols-1 gap-2 sm:grid-cols-3"
          role="list"
          aria-label="Key platform statistics"
        >
          <Stat
            icon={<Clock className="h-4 w-4 text-primary" />}
            label="Hourly refresh"
            ariaLabel="Papers refreshed every hour"
          />
          <Stat
            icon={<Layers className="h-4 w-4 text-primary" />}
            label="6 core arXiv areas"
            ariaLabel="Covers 6 core arXiv research areas"
          />
          <Stat
            icon={<Ban className="h-4 w-4 text-primary" />}
            label="No PDFs. No RAG."
            ariaLabel="No PDF parsing or RAG required"
          />
        </div>

        {/* Preview */}
        <div className="mt-10">
          <div className="mx-auto max-w-5xl overflow-hidden rounded-xl border bg-card shadow-sm">
            <Empty className="p-8 md:p-12">
              <EmptyHeader>
                <EmptyMedia variant="icon" className="bg-accent ring-1 ring-ring">
                  <LayoutGrid className="h-5 w-5 text-primary" />
                </EmptyMedia>
                <EmptyTitle>Preview</EmptyTitle>
                <EmptyDescription>
                  Screenshots are coming soon. Launch the app to explore the Feed and Paper pages.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button asChild className="btn-primary gap-2">
                  <Link href="/feed" prefetch>
                    {authed ? "Go to feed" : "Launch app"}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </EmptyContent>
            </Empty>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section
        className="mx-auto max-w-6xl px-4 md:px-6 py-14"
        aria-labelledby="features-title"
      >
        <h2 id="features-title" className="sr-only">Features</h2>
        <FeatureHighlight />
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="list">
          <FeatureTile
            icon={<Zap className="h-5 w-5 text-primary" />}
            title={FEATURES[0].title}
            description={FEATURES[0].description}
            href={FEATURES[0].href}
          />
          <FeatureTile
            icon={<GraduationCap className="h-5 w-5 text-primary" />}
            title={FEATURES[1].title}
            description={FEATURES[1].description}
            href={FEATURES[1].href}
          />
          <FeatureTile
            icon={<Beaker className="h-5 w-5 text-primary" />}
            title={FEATURES[2].title}
            description={FEATURES[2].description}
            href={FEATURES[2].href}
          />
          <FeatureTile
            icon={<Trophy className="h-5 w-5 text-primary" />}
            title={FEATURES[3].title}
            description={FEATURES[3].description}
            href={FEATURES[3].href}
          />
          <FeatureTile
            icon={<ListChecks className="h-5 w-5 text-primary" />}
            title={FEATURES[4].title}
            description={FEATURES[4].description}
            href={FEATURES[4].href}
          />
          <FeatureTile
            icon={<Code className="h-5 w-5 text-primary" />}
            title={FEATURES[5].title}
            description={FEATURES[5].description}
            href={FEATURES[5].href}
          />
        </div>
      </section>

      {/* How It Works Section */}
      <section
        className="mx-auto max-w-6xl px-4 md:px-6 py-14"
        aria-labelledby="how-it-works-title"
      >
        <div className="flex items-end justify-between">
          <h2 id="how-it-works-title" className="text-xl font-semibold tracking-tight">
            How it works
          </h2>
          <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
            <GitCompare className="h-4 w-4" aria-hidden="true" />
            <span>Compare papers side‑by‑side in the app</span>
          </div>
        </div>
        <div className="relative mt-8">
          <div
            className="pointer-events-none absolute left-0 right-0 top-8 hidden h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent md:block"
            aria-hidden="true"
          />
          <ol className="grid gap-5 md:grid-cols-3">
            {TIMELINE_STEPS.map((step) => (
              <TimelineStep key={step.number} number={step.number} title={step.title} bullets={step.bullets} />
            ))}
          </ol>
        </div>
      </section>

      {/* Built For Section */}
      <section
        className="mx-auto max-w-6xl px-4 md:px-6 py-14"
        aria-labelledby="built-for-title"
      >
        <div className="flex items-baseline justify-between">
          <h2 id="built-for-title" className="text-xl font-semibold tracking-tight">
            Built for
          </h2>
          <p className="hidden md:block text-xs text-muted-foreground">Different roles, same momentum.</p>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3" role="list">
          <PersonaTile
            icon={<GraduationCap className="h-4 w-4 text-primary" />}
            title={PERSONAS[0].title}
            points={PERSONAS[0].points}
            chips={PERSONAS[0].chips}
          />
          <PersonaTile
            icon={<Beaker className="h-4 w-4 text-primary" />}
            title={PERSONAS[1].title}
            points={PERSONAS[1].points}
            chips={PERSONAS[1].chips}
          />
          <PersonaTile
            icon={<Code className="h-4 w-4 text-primary" />}
            title={PERSONAS[2].title}
            points={PERSONAS[2].points}
            chips={PERSONAS[2].chips}
          />
        </div>
      </section>

      {/* FAQ Section */}
      <section
        className="mx-auto max-w-5xl px-4 md:px-6 pb-16"
        aria-labelledby="faq-title"
      >
        <h2 id="faq-title" className="text-lg font-semibold tracking-tight">FAQ</h2>
        <div className="mt-4 space-y-3">
          {FAQS.map((faq) => (
            <FaqItem key={faq.question} question={faq.question} answer={faq.answer} />
          ))}
        </div>

        <div className="mt-8">
          <Button asChild className="btn-primary gap-2">
            <Link href="/feed" prefetch>
              Get started
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}