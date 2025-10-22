// components/compare/compare-content.tsx
"use client";

import { ArrowLeftRight, Dice6, Info, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import ColumnSkeleton from "@/components/compare/column-skeleton";
import PaperColumn from "@/components/compare/paper-column";
import { useCompareIds } from "@/hooks/use-compare-ids";
import { useCompareQuery } from "@/hooks/use-compare-query";

export default function CompareContent() {
  const {
    idAInput,
    idBInput,
    setIdAInput,
    setIdBInput,
    idA,
    idB,
    validA,
    validB,
    onApply,
    onSwap,
    onRandom,
    onInputsKeyDown,
  } = useCompareIds();

  const { data, isLoading, isError, refetch } = useCompareQuery(idA, idB);

  const items = data?.items ?? [];
  const paperA = items[0] ?? (idA ? { arxivId: idA, found: false } : null);
  const paperB = items[1] ?? (idB ? { arxivId: idB, found: false } : null);

  return (
    <div className="mx-auto w-full max-w-7xl">
      {/* Header + controls */}
      <div className="flex flex-col gap-3 pb-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Compare papers</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Paste arXiv IDs or URLs. We’ll align key fields side‑by‑side.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
          <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
            <Input
              value={idAInput}
              onChange={(e) => setIdAInput(e.target.value)}
              onKeyDown={onInputsKeyDown}
              placeholder="e.g. 2501.10000 or https://arxiv.org/abs/2501.10000v2"
              aria-label="Paper A arXiv ID or URL"
              aria-invalid={!validA}
              className={!validA ? "ring-1 ring-destructive/50" : ""}
            />
            <Input
              value={idBInput}
              onChange={(e) => setIdBInput(e.target.value)}
              onKeyDown={onInputsKeyDown}
              placeholder="e.g. 2501.10011"
              aria-label="Paper B arXiv ID or URL"
              aria-invalid={!validB}
              className={!validB ? "ring-1 ring-destructive/50" : ""}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onSwap} aria-label="Swap">
              <ArrowLeftRight className="mr-2 h-4 w-4" />
              Swap
            </Button>
            <Button variant="outline" onClick={onRandom} aria-label="Randomize">
              <Dice6 className="mr-2 h-4 w-4" />
              Random
            </Button>
            <Button className="btn-primary" onClick={onApply} disabled={!validA || !validB}>
              Compare
            </Button>
          </div>
        </div>
      </div>

      <Separator className="mb-4 opacity-50" />

      {/* Error state */}
      {isError ? (
        <div className="rounded-xl border bg-card p-6">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <WifiOff className="h-6 w-6 text-muted-foreground" />
              </EmptyMedia>
              <EmptyTitle>Couldn’t load comparison</EmptyTitle>
              <EmptyDescription>
                We couldn’t fetch data from the server. Check your connection and try again.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => refetch()}>Retry</Button>
                <Button variant="outline" onClick={onRandom}>
                  Randomize
                </Button>
              </div>
            </EmptyContent>
          </Empty>
        </div>
      ) : (
        <>
          {/* Columns */}
          <div className="grid gap-4 md:grid-cols-2">
            {isLoading ? <ColumnSkeleton /> : <PaperColumn paper={paperA} placeholder="A" />}
            {isLoading ? <ColumnSkeleton /> : <PaperColumn paper={paperB} placeholder="B" />}
          </div>

          {/* Disclaimer */}
          <div className="mt-6 rounded-xl border bg-card p-4">
            <div className="mb-1 inline-flex items-center gap-2 text-xs text-muted-foreground">
              <Info className="h-3.5 w-3.5" />
              Based on title + abstract (and README if linked). No PDFs or RAG in MVP.
            </div>
          </div>
        </>
      )}
    </div>
  );
}