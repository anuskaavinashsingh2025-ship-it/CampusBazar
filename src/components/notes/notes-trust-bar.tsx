import { ArrowLeftRight, Award, Eye, Users } from "lucide-react";

import { cn } from "@/lib/utils";

const FEATURES = [
  {
    icon: Users,
    title: "100% Campus Community",
    description: "VIT students only — trusted peer marketplace",
  },
  {
    icon: Eye,
    title: "Quality You Can See",
    description: "Preview listings before you buy or rent",
  },
  {
    icon: ArrowLeftRight,
    title: "Buy • Sell • Exchange",
    description: "Notes, textbooks, and study materials",
  },
  {
    icon: Award,
    title: "Better Notes, Better Scores",
    description: "Learn smarter with shared resources",
  },
] as const;

export function NotesTrustBar({ className }: { className?: string }) {
  return (
    <section
      className={cn(
        "grid grid-cols-1 gap-4 rounded-3xl border border-border/40 bg-card/60 p-5 shadow-sm backdrop-blur-sm sm:grid-cols-2 lg:grid-cols-4",
        className,
      )}
    >
      {FEATURES.map((feature) => (
        <div key={feature.title} className="flex gap-3 rounded-2xl p-2">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <feature.icon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">{feature.title}</h3>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              {feature.description}
            </p>
          </div>
        </div>
      ))}
    </section>
  );
}
