import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { FeatureTileProps } from "@/types/marketing";

export function FeatureTile({ icon, title, description, href = "/feed" }: FeatureTileProps) {
  const content = (
    <>
      <span
        className="pointer-events-none absolute left-0 top-4 bottom-4 w-px bg-gradient-to-b from-primary/0 via-primary/50 to-primary/0"
        aria-hidden="true"
      />
      <div className="flex items-start gap-3">
        <div className="rounded-md bg-accent p-2 ring-1 ring-ring" aria-hidden="true">
          {icon}
        </div>
        <div>
          <div className="font-medium">{title}</div>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          <div className="mt-3 inline-flex items-center text-xs text-primary">
            Open in app
            <ChevronRight className="ml-0.5 h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </div>
        </div>
      </div>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="group relative block overflow-hidden rounded-xl border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        {content}
      </Link>
    );
  }

  return (
    <div className="group relative overflow-hidden rounded-xl border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-sm">
      {content}
    </div>
  );
}