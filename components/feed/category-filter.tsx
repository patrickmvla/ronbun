import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DEFAULT_CATEGORIES, CATEGORY_LABELS } from "@/config/feed";

interface CategoryFilterProps {
  selectedCategories: string[];
  onToggle: (category: string) => void;
}

export function CategoryFilter({
  selectedCategories,
  onToggle,
}: CategoryFilterProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2">
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          Filters
          <span className="ml-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
            {selectedCategories.length}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Categories</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="max-h-64 overflow-auto pr-1">
          {DEFAULT_CATEGORIES.map((category) => (
            <DropdownMenuCheckboxItem
              key={category}
              checked={selectedCategories.includes(category)}
              onCheckedChange={() => onToggle(category)}
              disabled={
                selectedCategories.length === 1 &&
                selectedCategories.includes(category)
              }
            >
              <div className="flex flex-col">
                <span className="font-medium">{category}</span>
                <span className="text-xs text-muted-foreground">
                  {CATEGORY_LABELS[category]}
                </span>
              </div>
            </DropdownMenuCheckboxItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}