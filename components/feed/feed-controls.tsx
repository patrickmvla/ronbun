import type { ViewTab } from "@/types/feed";
import { ViewSelector } from "./view-selector";
import { CategoryFilter } from "./category-filter";

interface FeedControlsProps {
  view: ViewTab;
  onViewChange: (view: ViewTab) => void;
  selectedCategories: string[];
  onCategoryToggle: (category: string) => void;
}

export function FeedControls({
  view,
  onViewChange,
  selectedCategories,
  onCategoryToggle,
}: FeedControlsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ViewSelector value={view} onChange={onViewChange} />
      <CategoryFilter
        selectedCategories={selectedCategories}
        onToggle={onCategoryToggle}
      />
    </div>
  );
}