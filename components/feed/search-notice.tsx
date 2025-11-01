"use client";

import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSearch } from "@/stores/useSearch";
import { Button } from "@/components/ui/button";

interface SearchNoticeProps {
  query: string;
  categoryCount: number;
}

export function SearchNotice({ query, categoryCount }: SearchNoticeProps) {
  const router = useRouter();
  const { clearQuery } = useSearch();

  const handleClear = () => {
    clearQuery();
    router.push("/feed");
  };

  if (!query) return null;

  return (
    <div className="mb-3 flex items-center justify-between gap-2 rounded-md border bg-card/50 px-3 py-2 text-xs text-muted-foreground">
      <div className="flex items-center gap-2">
        <Search className="h-4 w-4" aria-hidden="true" />
        <span>
          Searching for <strong className="text-foreground">&quot;{query}&quot;</strong>{" "}
          within {categoryCount} {categoryCount === 1 ? "category" : "categories"}
        </span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleClear}
        className="h-6 px-2 hover:bg-destructive/10"
      >
        <X className="h-3 w-3" />
        <span className="sr-only">Clear search</span>
      </Button>
    </div>
  );
}
