import type { LucideIcon } from "lucide-react";
import {
  BookMarked,
  BookOpen,
  ClipboardList,
  FileStack,
  FlaskConical,
  Grid3X3,
  ScrollText,
} from "lucide-react";

import { cn } from "@/lib/utils";

export type NotesCategoryItem = {
  key: string;
  label: string;
  icon: LucideIcon;
  color: string;
  count: number;
};

type NotesCategoryRowProps = {
  title: string;
  description: string;
  icon: LucideIcon;
  categories: NotesCategoryItem[];
  className?: string;
};

export function NotesCategoryRow({
  title,
  description,
  icon: SectionIcon,
  categories,
  className,
}: NotesCategoryRowProps) {
  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <SectionIcon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
              {title}
            </h2>
            <p className="text-xs text-muted-foreground sm:text-sm">{description}</p>
          </div>
        </div>
        <span className="shrink-0 text-xs font-medium text-primary">View all →</span>
      </div>

      <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2 scrollbar-none">
        {categories.map((cat) => (
          <div
            key={cat.key}
            className="group min-w-[148px] max-w-[148px] shrink-0 snap-start rounded-2xl border border-border/50 bg-card p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md sm:min-w-[160px] sm:max-w-[160px]"
          >
            <div
              className={cn(
                "mb-3 flex h-11 w-11 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105",
                cat.color,
              )}
            >
              <cat.icon className="h-5 w-5" />
            </div>
            <div className="text-sm font-semibold leading-tight text-foreground">{cat.label}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              {cat.count.toLocaleString()} {cat.count === 1 ? "Listing" : "Listings"}
            </div>
          </div>
        ))}
        <div className="min-w-[120px] shrink-0 snap-start rounded-2xl border border-dashed border-border/70 bg-muted/30 p-4">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <Grid3X3 className="h-5 w-5" />
          </div>
          <div className="text-sm font-semibold text-foreground">All Categories</div>
          <div className="mt-1 text-[11px] text-muted-foreground">Browse everything</div>
        </div>
      </div>
    </section>
  );
}

export const HANDWRITTEN_CATEGORIES: Omit<NotesCategoryItem, "count">[] = [
  {
    key: "Handwritten Notes",
    label: "Class Notes",
    icon: FileStack,
    color: "bg-orange-100 text-orange-600",
  },
  {
    key: "Lab Material",
    label: "Lab Records",
    icon: FlaskConical,
    color: "bg-sky-100 text-sky-600",
  },
  {
    key: "Previous Year Questions (PYQs)",
    label: "Previous Year Questions",
    icon: ClipboardList,
    color: "bg-amber-100 text-amber-700",
  },
  {
    key: "Cheat Sheets",
    label: "Cheat Sheets",
    icon: ScrollText,
    color: "bg-violet-100 text-violet-600",
  },
];

export const TEXTBOOK_CATEGORIES: Omit<NotesCategoryItem, "count">[] = [
  {
    key: "Textbooks",
    label: "Core Textbooks",
    icon: BookOpen,
    color: "bg-emerald-100 text-emerald-700",
  },
  {
    key: "Exam Kits",
    label: "Exam Kits",
    icon: BookMarked,
    color: "bg-rose-100 text-rose-600",
  },
];
