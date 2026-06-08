import {
  getNotesCategoriesForTab,
  NOTES_ALL_CATEGORY_ICON,
  type NotesCategoryOption,
} from "@/lib/notes-categories";
import { cn } from "@/lib/utils";

type NotesCategoryFilterBarProps = {
  tab: "sell" | "rent";
  categoryFilter: string;
  onCategoryChange: (category: string) => void;
  className?: string;
};

export function NotesCategoryFilterBar({
  tab,
  categoryFilter,
  onCategoryChange,
  className,
}: NotesCategoryFilterBarProps) {
  const categories = getNotesCategoriesForTab(tab);
  const AllIcon = NOTES_ALL_CATEGORY_ICON;

  const handleSelect = (key: string) => {
    onCategoryChange(categoryFilter === key ? "all" : key);
  };

  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground sm:text-base">Browse by Category</h2>
        {categoryFilter !== "all" ? (
          <button
            type="button"
            className="text-xs font-medium text-primary hover:underline"
            onClick={() => onCategoryChange("all")}
          >
            Clear filter
          </button>
        ) : null}
      </div>

      <div className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1 scrollbar-none sm:gap-3">
        <CategoryChip
          label="All"
          active={categoryFilter === "all"}
          onClick={() => onCategoryChange("all")}
          icon={AllIcon}
          iconClassName="bg-muted text-muted-foreground"
        />
        {categories.map((cat) => (
          <CategoryChip
            key={cat.key}
            label={cat.label}
            active={categoryFilter === cat.key}
            onClick={() => handleSelect(cat.key)}
            icon={cat.icon}
            iconClassName={cat.color}
          />
        ))}
      </div>
    </section>
  );
}

function CategoryChip({
  label,
  active,
  onClick,
  icon: Icon,
  iconClassName,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  icon: NotesCategoryOption["icon"] | typeof NOTES_ALL_CATEGORY_ICON;
  iconClassName: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-w-[88px] shrink-0 snap-start flex-col items-center gap-2 rounded-xl border p-3 text-xs transition-colors sm:min-w-[96px]",
        active ? "border-primary bg-primary/10 text-primary" : "border-border/60 bg-card hover:bg-muted/40",
      )}
    >
      <div
        className={cn("flex h-10 w-10 items-center justify-center rounded-lg", iconClassName)}
      >
        <Icon className="h-5 w-5" />
      </div>
      <span className="text-center font-medium leading-tight">{label}</span>
    </button>
  );
}
