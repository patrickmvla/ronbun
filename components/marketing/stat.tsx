import { StatProps } from "@/types/marketing";

export function Stat({ icon, label, ariaLabel }: StatProps) {
  return (
    <div
      className="flex items-center justify-center gap-2 rounded-md border bg-card/80 px-3 py-2 text-xs text-foreground/80 backdrop-blur"
      role="status"
      aria-label={ariaLabel || label}
    >
      <span aria-hidden="true">{icon}</span>
      <span>{label}</span>
    </div>
  );
}