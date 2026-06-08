import { BookOpen, FileText, Users } from "lucide-react";

import { cn } from "@/lib/utils";

type NotesHeroProps = {
  totalListings: number;
  subjectCount: number;
  activeSellers: number;
  className?: string;
};

export function NotesHero({
  totalListings,
  subjectCount,
  activeSellers,
  className,
}: NotesHeroProps) {
  const stats = [
    { label: "Total Listings", value: totalListings, icon: FileText },
    { label: "Subjects", value: subjectCount, icon: BookOpen },
    { label: "Active Sellers", value: activeSellers, icon: Users },
  ];

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-3xl border border-primary/10 bg-gradient-to-br from-primary/12 via-card to-accent/30 px-6 py-8 shadow-sm sm:px-8 sm:py-10",
        className,
      )}
    >
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-primary/15 blur-3xl motion-safe:animate-pulse"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-10 left-1/4 h-32 w-32 rounded-full bg-orange-300/20 blur-3xl motion-safe:animate-pulse"
        style={{ animationDelay: "1.5s" }}
        aria-hidden
      />

      <div className="relative">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary/80">Notes Hub</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Notes</h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">
          Buy, Sell &amp; Exchange Academic Resources
        </p>
        <p className="mt-1 text-xs text-muted-foreground/80 sm:text-sm">
          Buy, sell and exchange academic materials within your campus.
        </p>

        <div className="mt-6 grid grid-cols-3 gap-3 sm:gap-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-white/60 bg-card/70 px-3 py-3 shadow-sm backdrop-blur-sm sm:px-4 sm:py-4"
            >
              <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <stat.icon className="h-4 w-4" />
              </div>
              <div className="text-lg font-bold text-foreground sm:text-xl">
                {stat.value.toLocaleString()}
              </div>
              <div className="text-[10px] font-medium text-muted-foreground sm:text-xs">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
