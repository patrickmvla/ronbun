"use client";

import { Package, Code, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

interface AdvancedFiltersProps {
  codeOnly: boolean;
  hasWeights: boolean;
  withBenchmarks: boolean;
  onCodeOnlyChange: (value: boolean) => void;
  onHasWeightsChange: (value: boolean) => void;
  onWithBenchmarksChange: (value: boolean) => void;
}

export function AdvancedFilters({
  codeOnly,
  hasWeights,
  withBenchmarks,
  onCodeOnlyChange,
  onHasWeightsChange,
  onWithBenchmarksChange,
}: AdvancedFiltersProps) {
  const activeCount = [codeOnly, hasWeights, withBenchmarks].filter(Boolean).length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-2">
          <span>More</span>
          {activeCount > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 min-w-5 rounded-full px-1.5 text-xs">
              {activeCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Advanced Filters</DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuCheckboxItem
          checked={codeOnly}
          onCheckedChange={onCodeOnlyChange}
        >
          <div className="flex items-center gap-2">
            <Code className="h-4 w-4 text-primary" />
            <div className="flex flex-col">
              <span className="font-medium">Code Available</span>
              <span className="text-xs text-muted-foreground">
                Only papers with code repos
              </span>
            </div>
          </div>
        </DropdownMenuCheckboxItem>

        <DropdownMenuCheckboxItem
          checked={hasWeights}
          onCheckedChange={onHasWeightsChange}
        >
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            <div className="flex flex-col">
              <span className="font-medium">Model Weights</span>
              <span className="text-xs text-muted-foreground">
                Only papers with pre-trained weights
              </span>
            </div>
          </div>
        </DropdownMenuCheckboxItem>

        <DropdownMenuCheckboxItem
          checked={withBenchmarks}
          onCheckedChange={onWithBenchmarksChange}
        >
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            <div className="flex flex-col">
              <span className="font-medium">Benchmarks</span>
              <span className="text-xs text-muted-foreground">
                Only papers with benchmark results
              </span>
            </div>
          </div>
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
