"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { FaqItemProps } from "@/types/marketing";
import { cn } from "@/lib/utils";

export function FaqItem({ question, answer }: FaqItemProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <details
      open={isOpen}
      onToggle={(e) => setIsOpen(e.currentTarget.open)}
      className="group rounded-lg border bg-card p-4 transition-all open:border-primary/30 open:shadow-sm"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-sm">
        <span className="text-sm font-medium">{question}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            isOpen && "rotate-180"
          )}
          aria-hidden="true"
        />
      </summary>
      <div className="mt-2 pl-1 text-sm text-muted-foreground animate-in slide-in-from-top-2">
        {answer}
      </div>
    </details>
  );
}