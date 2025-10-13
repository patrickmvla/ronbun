import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ViewTab } from "@/types/feed";
import { VIEW_OPTIONS } from "@/config/feed";

interface ViewSelectorProps {
  value: ViewTab;
  onChange: (view: ViewTab) => void;
}

export function ViewSelector({ value, onChange }: ViewSelectorProps) {
  return (
    <div
      className="grid h-9 grid-cols-3 overflow-hidden rounded-md border bg-card"
      role="tablist"
      aria-label="Feed view options"
    >
      {VIEW_OPTIONS.map((option) => {
        const isActive = value === option.value;

        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-label={option.description || option.label}
            onClick={() => onChange(option.value)}
            className={cn(
              "px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:z-10",
              isActive
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
            )}
          >
            {option.label}
            {/* ✅ Render icon based on flag */}
            {option.showSparkles && (
              <Sparkles 
                className="ml-1 inline h-3.5 w-3.5 text-primary" 
                aria-hidden="true"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}