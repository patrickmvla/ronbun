import { Search } from "lucide-react";

interface SearchNoticeProps {
  query: string;
  categoryCount: number;
}

export function SearchNotice({ query, categoryCount }: SearchNoticeProps) {
  if (!query) return null;

  return (
    <div className="mb-3 flex items-center gap-2 rounded-md border bg-card/50 px-3 py-2 text-xs text-muted-foreground">
      <Search className="h-4 w-4" aria-hidden="true" />
      <span>
        Searching for <strong className="text-foreground">&quot;{query}&quot;</strong>{" "}
        within {categoryCount} {categoryCount === 1 ? "category" : "categories"}
      </span>
    </div>
  );
}
