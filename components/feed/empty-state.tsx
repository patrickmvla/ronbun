import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import type { EmptyStateProps } from "@/types/feed";

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <Empty className="p-8">
        <EmptyHeader>
          <EmptyMedia variant="icon" />
          <EmptyTitle>{title}</EmptyTitle>
          {description && <EmptyDescription>{description}</EmptyDescription>}
        </EmptyHeader>
        {action && <EmptyContent>{action}</EmptyContent>}
      </Empty>
    </div>
  );
}