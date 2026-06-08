import type { LucideIcon } from "lucide-react";
import { FileText, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type NotesEmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  isSearchEmpty?: boolean;
  className?: string;
};

export function NotesEmptyState({
  icon: Icon = FileText,
  title,
  description,
  actionLabel,
  onAction,
  isSearchEmpty,
  className,
}: NotesEmptyStateProps) {
  const DisplayIcon = isSearchEmpty ? Search : Icon;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-3xl border border-dashed border-border/60 bg-muted/20 px-6 py-16 text-center",
        className,
      )}
    >
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <DisplayIcon className="h-8 w-8" />
      </div>
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">{description}</p>
      {actionLabel && onAction ? (
        <Button className="mt-6 rounded-full px-6" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}

export function NotesLoadingGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-2xl border border-border/40 bg-card shadow-sm"
        >
          <div className="aspect-[4/3] animate-pulse bg-muted/60" />
          <div className="space-y-3 p-4">
            <div className="h-4 w-3/4 animate-pulse rounded-md bg-muted" />
            <div className="h-3 w-1/2 animate-pulse rounded-md bg-muted/70" />
            <div className="h-8 w-1/3 animate-pulse rounded-md bg-muted/50" />
          </div>
        </div>
      ))}
    </div>
  );
}
