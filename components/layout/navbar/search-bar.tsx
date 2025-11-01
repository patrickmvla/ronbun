"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NAVBAR_CONFIG } from "@/config/navigation";
import { useSearch } from "@/stores/useSearch";

interface SearchBarProps {
  className?: string;
}

export function SearchBar({ className }: SearchBarProps) {
  const [localQuery, setLocalQuery] = useState("");
  const { setQuery, setIsSearching } = useSearch();
  const router = useRouter();

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      const trimmedQuery = localQuery.trim();
      if (!trimmedQuery) return;

      setIsSearching(true);

      try {
        // Update global search state
        setQuery(trimmedQuery);
        // Navigate to feed with search query
        router.push(`/feed?q=${encodeURIComponent(trimmedQuery)}`);
      } catch (error) {
        console.error("Search navigation error:", error);
      } finally {
        setIsSearching(false);
      }
    },
    [localQuery, router, setQuery, setIsSearching]
  );

  return (
    <form onSubmit={handleSubmit} className={className}>
      <label htmlFor="navbar-search" className="sr-only">
        {NAVBAR_CONFIG.searchPlaceholder}
      </label>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="navbar-search"
            type="search"
            value={localQuery}
            onChange={(e) => setLocalQuery(e.target.value)}
            placeholder={NAVBAR_CONFIG.searchPlaceholder}
            maxLength={NAVBAR_CONFIG.maxSearchLength}
            className="pl-8"
            aria-label="Search papers, authors, and benchmarks"
          />
        </div>
        <Button
          type="submit"
          disabled={!localQuery.trim()}
          className="btn-primary"
        >
          Search
        </Button>
      </div>
    </form>
  );
}