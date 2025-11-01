import type { ViewTab } from "@/types/feed";
import { ViewSelector } from "./view-selector";
import { CategoryFilter } from "./category-filter";
import { AdvancedFilters } from "./advanced-filters";

interface FeedControlsProps {
  view: ViewTab;
  onViewChange: (view: ViewTab) => void;
  selectedCategories: string[];
  onCategoryToggle: (category: string) => void;
  codeOnly?: boolean;
  hasWeights?: boolean;
  withBenchmarks?: boolean;
  onCodeOnlyChange?: (value: boolean) => void;
  onHasWeightsChange?: (value: boolean) => void;
  onWithBenchmarksChange?: (value: boolean) => void;
}

export function FeedControls({
  view,
  onViewChange,
  selectedCategories,
  onCategoryToggle,
  codeOnly = false,
  hasWeights = false,
  withBenchmarks = false,
  onCodeOnlyChange,
  onHasWeightsChange,
  onWithBenchmarksChange,
}: FeedControlsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ViewSelector value={view} onChange={onViewChange} />
      <CategoryFilter
        selectedCategories={selectedCategories}
        onToggle={onCategoryToggle}
      />
      {onCodeOnlyChange && onHasWeightsChange && onWithBenchmarksChange && (
        <AdvancedFilters
          codeOnly={codeOnly}
          hasWeights={hasWeights}
          withBenchmarks={withBenchmarks}
          onCodeOnlyChange={onCodeOnlyChange}
          onHasWeightsChange={onHasWeightsChange}
          onWithBenchmarksChange={onWithBenchmarksChange}
        />
      )}
    </div>
  );
}