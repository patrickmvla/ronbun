// components/forms/watchlist-form.tsx
"use client";

import * as React from "react";
import { z } from "zod";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tag,
  Users,
  BarChart3,
  Landmark,
  X,
} from "lucide-react";

/**
 * Reusable Watchlist form (create/edit)
 *
 * Usage:
 * <WatchlistForm
 *   initial={{ type: "keyword", name: "Distillation", terms: ["distillation"], categories: DEFAULT_CATS }}
 *   onSubmit={async (values) => { ... }}
 *   onCancel={() => ...}
 * />
 */

export const DEFAULT_CATS = ["cs.AI", "cs.LG", "cs.CL", "cs.CV", "cs.NE", "stat.ML"] as const;
export type WatchlistType = "keyword" | "author" | "benchmark" | "institution";

export const WatchlistSchema = z.object({
  type: z.enum(["keyword", "author", "benchmark", "institution"]),
  name: z.string().min(2, "Name is too short").max(64, "Name is too long"),
  terms: z
    .array(z.string().min(2).max(64))
    .min(1, "Add at least one term")
    .max(20, "Too many terms (max 20)"),
  categories: z
    .array(z.string())
    .min(1, "Select at least one category")
    .refine((arr) => arr.every((c) => (DEFAULT_CATS as readonly string[]).includes(c)), "Invalid category"),
});
export type WatchlistFormValues = z.infer<typeof WatchlistSchema>;

export type WatchlistFormProps = {
  initial?: Partial<WatchlistFormValues>;
  categoriesOptions?: readonly string[];
  submitLabel?: string;
  cancelLabel?: string;
  onSubmit: (values: WatchlistFormValues) => Promise<void> | void;
  onCancel?: () => void;
  className?: string;
};

export default function WatchlistForm({
  initial,
  categoriesOptions = DEFAULT_CATS,
  submitLabel = "Save watchlist",
  cancelLabel = "Cancel",
  onSubmit,
  onCancel,
  className,
}: WatchlistFormProps) {
  const form = useForm<WatchlistFormValues>({
    resolver: zodResolver(WatchlistSchema),
    mode: "onChange",
    defaultValues: {
      type: initial?.type ?? "keyword",
      name: initial?.name ?? "",
      terms: initial?.terms ?? [],
      categories: initial?.categories && initial.categories.length ? initial.categories : [...categoriesOptions],
    },
  });

  const type = form.watch("type");
  const terms = form.watch("terms");
  const cats = form.watch("categories");

  const handleSubmit = form.handleSubmit(async (values) => {
    await onSubmit(values);
  });

  return (
    <form onSubmit={handleSubmit} className={["space-y-3", className || ""].join(" ")}>
      {/* Type */}
      <div>
        <div className="text-xs uppercase tracking-wide text-muted-foreground">Type</div>
        <TypeSegment
          value={type}
          onChange={(v) => form.setValue("type", v, { shouldValidate: true })}
        />
        {form.formState.errors.type ? (
          <p className="mt-1 text-xs text-destructive">
            {form.formState.errors.type.message as string}
          </p>
        ) : null}
      </div>

      {/* Name */}
      <div>
        <label className="text-xs text-muted-foreground" htmlFor="wl-name">
          Name
        </label>
        <Input
          id="wl-name"
          placeholder="e.g., Advisor + Lab"
          {...form.register("name")}
        />
        {form.formState.errors.name ? (
          <p className="mt-1 text-xs text-destructive">{form.formState.errors.name.message}</p>
        ) : null}
      </div>

      {/* Terms */}
      <div>
        <div className="flex items-center justify-between">
          <label className="text-xs text-muted-foreground" htmlFor="wl-term-input">
            Terms
          </label>
          <span className="text-xs text-muted-foreground">{terms.length}/20</span>
        </div>
        <Controller
          control={form.control}
          name="terms"
          render={({ field }) => (
            <TermsInput
              value={field.value || []}
              onChange={(v) => field.onChange(v)}
              placeholder={
                type === "author"
                  ? "Add author names…"
                  : type === "benchmark"
                  ? "Add benchmarks (e.g., MMLU)…"
                  : type === "institution"
                  ? "Add institutions (e.g., DeepMind)…"
                  : "Add keywords (e.g., distillation)…"
              }
            />
          )}
        />
        {form.formState.errors.terms ? (
          <p className="mt-1 text-xs text-destructive">
            {form.formState.errors.terms.message as string}
          </p>
        ) : null}
      </div>

      {/* Categories */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <div className="text-xs text-muted-foreground">Categories</div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="text-xs text-primary hover:underline"
              onClick={() => form.setValue("categories", [...categoriesOptions], { shouldValidate: true })}
            >
              Select all
            </button>
            <button
              type="button"
              className="text-xs text-muted-foreground hover:underline"
              onClick={() => form.setValue("categories", [], { shouldValidate: true })}
            >
              Clear
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {categoriesOptions.map((c) => {
            const checked = cats.includes(c);
            return (
              <label
                key={c}
                className="flex items-center gap-2 rounded-md border bg-card/80 px-2 py-1.5 text-xs"
              >
                <input
                  type="checkbox"
                  className="accent-[color:var(--primary)]"
                  checked={checked}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? [...cats, c]
                      : cats.filter((x: string) => x !== c);
                    form.setValue("categories", next, { shouldValidate: true });
                  }}
                />
                <span>{c}</span>
              </label>
            );
          })}
        </div>
        {form.formState.errors.categories ? (
          <p className="mt-1 text-xs text-destructive">
            {form.formState.errors.categories.message as string}
          </p>
        ) : null}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-1">
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            {cancelLabel}
          </Button>
        ) : null}
        <Button
          type="submit"
          className="btn-primary"
          disabled={!form.formState.isValid || form.formState.isSubmitting}
        >
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

/* ========== UI bits ========== */

function TypeSegment({
  value,
  onChange,
}: {
  value: WatchlistType;
  onChange: (v: WatchlistType) => void;
}) {
  const items: { v: WatchlistType; label: string; icon: React.ReactNode }[] = [
    { v: "keyword", label: "Keyword", icon: <Tag className="h-3.5 w-3.5" /> },
    { v: "author", label: "Author", icon: <Users className="h-3.5 w-3.5" /> },
    { v: "benchmark", label: "Benchmark", icon: <BarChart3 className="h-3.5 w-3.5" /> },
    { v: "institution", label: "Institution", icon: <Landmark className="h-3.5 w-3.5" /> },
  ];
  return (
    <div className="mt-1 grid grid-cols-2 gap-1 sm:grid-cols-4">
      {items.map((it) => (
        <button
          key={it.v}
          type="button"
          onClick={() => onChange(it.v)}
          className={[
            "inline-flex items-center justify-center gap-1 rounded-md border px-2 py-1.5 text-xs transition-colors",
            value === it.v
              ? "bg-accent text-foreground ring-1 ring-ring"
              : "text-muted-foreground hover:text-foreground hover:bg-accent",
          ].join(" ")}
          aria-pressed={value === it.v}
        >
          {it.icon}
          {it.label}
        </button>
      ))}
    </div>
  );
}

function TermsInput({
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
      // Quick remove last
      remove(value[value.length - 1]);
    }
  };

  const onPaste: React.ClipboardEventHandler<HTMLInputElement> = (e) => {
    const text = e.clipboardData.getData("text");
    if (!text) return;
    const parts = text
      .split(/[,;\n]/g)
      .map((s) => s.trim())
      .filter(Boolean);
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
        />
      </div>
    </div>
  );
}