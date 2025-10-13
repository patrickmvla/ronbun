// components/watchlists/terms-input.tsx
"use client";

import * as React from "react";
import { X } from "lucide-react";

export default function TermsInput({
  value,
  onChange,
  placeholder,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [input, setInput] = React.useState("");

  const add = (raw: string) => {
    const next = raw.trim();
    if (!next) return;
    if (value.includes(next)) return;
    if (next.length < 2 || next.length > 64) return;
    if (value.length >= 20) return;
    onChange([...value, next]);
    setInput("");
  };

  const remove = (term: string) => onChange(value.filter((t) => t !== term));

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === "," || e.key === ";") {
      e.preventDefault();
      add(input);
    } else if (e.key === "Backspace" && !input && value.length > 0) {
      remove(value[value.length - 1]);
    }
  };

  const onPaste: React.ClipboardEventHandler<HTMLInputElement> = (e) => {
    const text = e.clipboardData.getData("text");
    if (!text) return;
    const parts = text.split(/[,;\n]/g).map((s) => s.trim()).filter(Boolean);
    if (!parts.length) return;
    e.preventDefault();
    const merged = [...value];
    for (const p of parts) {
      if (!merged.includes(p) && p.length >= 2 && p.length <= 64 && merged.length < 20) {
        merged.push(p);
      }
    }
    onChange(merged);
  };

  return (
    <div className="rounded-md border bg-card/80 p-2">
      <div className="flex flex-wrap gap-1">
        {value.map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1 rounded-md border bg-card px-1.5 py-0.5 text-[11px]"
          >
            {t}
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground"
              aria-label={`Remove ${t}`}
              onClick={() => remove(t)}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}
        <input
          id="wl-term-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          placeholder={placeholder || "Add term and press Enter"}
          className="min-w-[140px] flex-1 bg-transparent p-1 text-sm outline-none placeholder:text-muted-foreground"
          aria-label="Add term"
        />
      </div>
    </div>
  );
}