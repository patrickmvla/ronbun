/* eslint-disable @typescript-eslint/no-explicit-any */
// components/watchlists/watchlist-composer.tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Sparkles } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { Controller, useForm, useWatch, type SubmitHandler } from "react-hook-form";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";

import { mockPreview } from "@/lib/watchlists-utils";
import {
  DEFAULT_CATS,
  WatchlistSchema,
  type WatchlistForm,
  type WatchlistItem,
} from "@/types/watchlists";
import TermsInput from "./terms-input";
import TypeSegment from "./type-segment";

export default function WatchlistComposer({
  editingItem,
  onCreate,
  onUpdate,
  onCancel,
}: {
  editingItem?: WatchlistItem | null;
  onCreate: (values: WatchlistForm) => Promise<any> | void;
  onUpdate: (id: string, values: WatchlistForm) => Promise<any> | void;
  onCancel: () => void;
}) {
  const form = useForm<WatchlistForm>({
    // @ts-expect-error - Schema transforms optional categories to required
    resolver: zodResolver(WatchlistSchema),
    defaultValues: editingItem
      ? {
          id: editingItem.id,
          type: editingItem.type,
          name: editingItem.name,
          terms: editingItem.terms,
          categories: editingItem.categories,
        }
      : {
          type: "keyword",
          name: "",
          terms: [],
          categories: [...DEFAULT_CATS],
        },
    mode: "onChange",
  });

  // Reset when editing item changes
  React.useEffect(() => {
    if (editingItem) {
      form.reset({
        id: editingItem.id,
        type: editingItem.type,
        name: editingItem.name,
        terms: editingItem.terms,
        categories: editingItem.categories,
      });
    } else {
      form.reset({
        type: "keyword",
        name: "",
        terms: [],
        categories: [...DEFAULT_CATS],
      });
    }
  }, [editingItem, form]);

  const type = useWatch({ control: form.control, name: "type" });
  const termsRaw = useWatch({ control: form.control, name: "terms" }) as string[] | undefined;
  const catsRaw = useWatch({ control: form.control, name: "categories" }) as string[] | undefined;

  const terms = React.useMemo(() => termsRaw ?? [], [termsRaw]);
  const cats = React.useMemo(() => catsRaw ?? [], [catsRaw]);

  const onSubmit: SubmitHandler<WatchlistForm> = async (values) => {
    if (editingItem?.id) {
      await onUpdate(editingItem.id, values);
    } else {
      await onCreate(values);
    }
    form.reset({
      type: "keyword",
      name: "",
      terms: [],
      categories: [...DEFAULT_CATS],
    });
  };

  const preview = React.useMemo(() => mockPreview(terms, type, cats), [terms, type, cats]);
  const isSubmitting = form.formState.isSubmitting;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
      {/* Form */}
      <section className="rounded-xl border bg-card p-4">
        {/* @ts-expect-error - Type inference issue from schema mismatch */}
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
          {/* Type segmented control */}
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Type</div>
            <TypeSegment
              value={type}
              onChange={(v) => form.setValue("type", v, { shouldValidate: true })}
            />
            {form.formState.errors.type ? (
              <p role="alert" className="mt-1 text-xs text-destructive">
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
              aria-invalid={!!form.formState.errors.name}
              disabled={isSubmitting}
              {...form.register("name")}
            />
            {form.formState.errors.name ? (
              <p role="alert" className="mt-1 text-xs text-destructive">
                {form.formState.errors.name.message}
              </p>
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
              <p role="alert" className="mt-1 text-xs text-destructive">
                {form.formState.errors.terms.message as string}
              </p>
            ) : null}
          </div>

          {/* Categories */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <div className="text-xs text-muted-foreground">Categories</div>
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={() =>
                  form.setValue("categories", [...DEFAULT_CATS], { shouldValidate: true })
                }
                disabled={isSubmitting}
              >
                Select all
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {DEFAULT_CATS.map((c) => {
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
                      disabled={isSubmitting}
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
              <p role="alert" className="mt-1 text-xs text-destructive">
                {form.formState.errors.categories.message as string}
              </p>
            ) : null}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-1">
            {editingItem ? (
              <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
                Cancel
              </Button>
            ) : null}
            <Button
              type="submit"
              className="btn-primary"
              disabled={!form.formState.isValid || isSubmitting}
            >
              {editingItem ? "Save changes" : "Create watchlist"}
            </Button>
          </div>
        </form>
      </section>

      {/* Preview */}
      <aside className="rounded-xl border bg-card p-4">
        <div className="mb-2 inline-flex items-center gap-2 rounded-md bg-accent px-2 py-1 text-xs ring-1 ring-ring">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span>Preview (mock)</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Based on your type, terms, and categories. This is a demo preview to help tune filters.
        </p>
        <div className="mt-3 space-y-2">
          {preview.length ? (
            preview.map((p) => (
              <div key={p.id} className="rounded-lg border bg-card/80 p-3">
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <Badge variant="outline" className="px-1.5 py-0.5 text-[10px]">
                    {p.category}
                  </Badge>
                  <span>•</span>
                  <span>{p.time}</span>
                </div>
                <div className="mt-1 line-clamp-2 text-sm font-medium">
                  <Link href={`/paper/${p.arxivId}`} className="hover:underline">
                    {p.title}
                  </Link>
                </div>
                <div className="mt-0.5 truncate text-xs text-muted-foreground">
                  {p.authors.join(", ")}
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-xl border bg-card p-6">
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Sparkles className="h-6 w-6 text-muted-foreground" />
                  </EmptyMedia>
                  <EmptyTitle>Add terms to see a preview</EmptyTitle>
                  <EmptyDescription>
                    Start by adding 1–3 terms to generate a mock preview of matching papers.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}