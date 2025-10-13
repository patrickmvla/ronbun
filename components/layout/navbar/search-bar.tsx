"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NAVBAR_CONFIG } from "@/config/navigation";

interface SearchBarProps {
  className?: string;
}

export function SearchBar({ className }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      
      const trimmedQuery = query.trim();
      if (!trimmedQuery) return;

      setIsSubmitting(true);
      
      try {
        router.push(`/feed?q=${encodeURIComponent(trimmedQuery)}`);
        // Optionally clear after navigation
        // setQuery("");
      } catch (error) {
        console.error("Search navigation error:", error);
      } finally {
        setIsSubmitting(false);
      }
    },
    [query, router]
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
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={NAVBAR_CONFIG.searchPlaceholder}
            maxLength={NAVBAR_CONFIG.maxSearchLength}
            disabled={isSubmitting}
            className="pl-8"
            aria-label="Search papers, authors, and benchmarks"
          />
        </div>
        <Button
          type="submit"
          disabled={!query.trim() || isSubmitting}
          className="btn-primary"
        >
          {isSubmitting ? "Searching..." : "Search"}
        </Button>
      </div>
    </form>
  );
}