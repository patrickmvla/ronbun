import { Check } from "lucide-react";
import { PersonaTileProps } from "@/types/marketing";

export function PersonaTile({ icon, title, points, chips }: PersonaTileProps) {
  return (
    <div className="group relative overflow-hidden rounded-xl border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-sm">
      <span
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-primary/0 via-primary/50 to-primary/0"
        aria-hidden="true"
      />
      <div className="flex items-start gap-3">
        <div className="rounded-md bg-accent p-2 ring-1 ring-ring" aria-hidden="true">
          {icon}
        </div>
        <div className="flex-1">
          <h3 className="font-medium">{title}</h3>
          <ul className="mt-2 space-y-1.5">
            {points.map((point) => (
              <li key={point} className="flex items-start gap-2 text-sm text-muted-foreground">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/80" aria-hidden="true" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
          {chips && chips.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2" role="list" aria-label="Feature tags">
              {chips.map((chip) => (
                <span
                  key={chip}
                  className="inline-flex items-center rounded-md border px-2 py-1 text-[11px]"
                >
                  {chip}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}