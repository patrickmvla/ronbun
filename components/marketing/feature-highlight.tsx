import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Zap,
  GraduationCap,
  Beaker,
  Trophy,
  ListChecks,
  Code,
  ChevronRight,
} from "lucide-react";
import { IconTile } from "./icon-tile";
import { Chip } from "./chip";
import { FEATURE_HIGHLIGHT } from "@/config/marketing-content";

export function FeatureHighlight() {
  const { badge, title, description, chips, cta } = FEATURE_HIGHLIGHT;

  return (
    <div className="relative overflow-hidden rounded-xl border bg-card p-6 md:p-8">
      {/* Decorative grid pattern */}
      <div
        className="pointer-events-none absolute inset-0 opacity-10"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
        aria-hidden="true"
      />
      {/* Decorative glow */}
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/10 blur-3xl"
        aria-hidden="true"
      />

      <div className="grid items-center gap-6 md:grid-cols-2">
        <div>
          <div className="inline-flex items-center gap-2 rounded-md bg-accent px-2 py-1 text-xs ring-1 ring-ring">
            <span className="text-primary">{badge.label}</span>
            <span className="text-muted-foreground">{badge.description}</span>
          </div>

          <h2 className="mt-3 text-lg font-semibold tracking-tight">{title}</h2>

          <p className="mt-2 text-sm text-muted-foreground">{description}</p>

          <div className="mt-4 flex flex-wrap gap-2" role="list" aria-label="Key features">
            {chips.map((chip) => (
              <Chip key={chip}>{chip}</Chip>
            ))}
          </div>

          <div className="mt-5">
            <Button asChild variant="secondary" className="hover:bg-accent group">
              <Link href={cta.href} prefetch>
                {cta.text}
                <ChevronRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-center">
          {/* Icon cluster */}
          <div className="relative">
            <div
              className="absolute -left-6 -top-6 h-10 w-10 rounded-md bg-accent ring-1 ring-ring"
              aria-hidden="true"
            />
            <div
              className="absolute -right-8 bottom-10 h-12 w-12 rounded-full bg-primary/10 blur-lg"
              aria-hidden="true"
            />
            <div className="grid grid-cols-3 gap-3" role="presentation">
              <IconTile label="Fast summaries">
                <Zap className="h-5 w-5 text-primary" />
              </IconTile>
              <IconTile label="Educational content">
                <GraduationCap className="h-5 w-5 text-primary" />
              </IconTile>
              <IconTile label="Reviewer mode">
                <Beaker className="h-5 w-5 text-primary" />
              </IconTile>
              <IconTile label="Leaderboards">
                <Trophy className="h-5 w-5 text-primary" />
              </IconTile>
              <IconTile label="Watchlists">
                <ListChecks className="h-5 w-5 text-primary" />
              </IconTile>
              <IconTile label="Code integration">
                <Code className="h-5 w-5 text-primary" />
              </IconTile>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}