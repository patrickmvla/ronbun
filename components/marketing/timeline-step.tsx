import { TimelineStepProps } from "@/types/marketing";

export function TimelineStep({ number, title, bullets }: TimelineStepProps) {
  return (
    <li className="relative rounded-xl border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-sm">
      <div className="flex items-center gap-3">
        <div
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/30"
          aria-hidden="true"
        >
          <span className="text-xs font-semibold">{number}</span>
        </div>
        <h3 className="font-medium">{title}</h3>
      </div>
      <ul className="mt-3 space-y-1.5">
        {bullets.map((bullet) => (
          <li key={bullet} className="flex items-start gap-2 text-sm text-muted-foreground">
            <span
              className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70"
              aria-hidden="true"
            />
            <span>{bullet}</span>
          </li>
        ))}
      </ul>
    </li>
  );
}