import type { ReactNode } from "react";
import { FileText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export type NotesListingCardData = {
  id: string;
  title: string;
  description: string;
  category: string;
  subject: string | null;
  branch: string | null;
  semester: string | null;
  seller_id: string;
  created_at: string;
  is_free?: boolean;
  is_digital?: boolean;
  daily_rental_price?: number | string | null;
  listing_type?: "sell" | "rent";
};

type NotesListingCardProps = {
  listing: NotesListingCardData;
  formatInr: (amount: number) => string;
  onClick: () => void;
  actions?: ReactNode;
  className?: string;
};

function timeAgo(iso: string) {
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60));
  if (h < 1) return "Just now";
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function metaLine(listing: NotesListingCardData) {
  const parts = [listing.branch, listing.semester ? `Sem ${listing.semester}` : null, listing.subject]
    .filter(Boolean)
    .slice(0, 3);
  return parts.length ? parts.join(" • ") : listing.category;
}

function categoryGradient(category: string) {
  const c = category.toLowerCase();
  if (c.includes("textbook")) return "from-emerald-100/80 to-emerald-50";
  if (c.includes("pyq") || c.includes("previous")) return "from-amber-100/80 to-amber-50";
  if (c.includes("lab")) return "from-sky-100/80 to-sky-50";
  return "from-orange-100/80 to-orange-50";
}

export function NotesListingCard({
  listing,
  formatInr,
  onClick,
  actions,
  className,
}: NotesListingCardProps) {
  const sellerInitials = listing.seller_id.slice(0, 2).toUpperCase();
  const isRent = listing.listing_type === "rent";

  return (
    <Card
      className={cn(
        "group relative cursor-pointer overflow-hidden border-border/40 bg-card shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-primary/20 hover:shadow-lg",
        className,
      )}
      onClick={onClick}
    >
      <div
        className={cn(
          "relative aspect-[4/3] overflow-hidden bg-gradient-to-br",
          categoryGradient(listing.category),
        )}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <FileText className="h-14 w-14 text-primary/25 transition-transform duration-300 group-hover:scale-110" />
        </div>
        <Badge className="absolute right-3 top-3 border-0 bg-white/90 text-[10px] font-semibold text-foreground shadow-sm backdrop-blur-sm">
          {listing.category}
        </Badge>
        {actions ? (
          <div
            className="absolute left-2 top-2 z-20"
            onClick={(e) => e.stopPropagation()}
            role="presentation"
          >
            {actions}
          </div>
        ) : null}
      </div>

      <CardContent className="flex min-h-[148px] flex-col p-4">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug tracking-tight text-foreground sm:text-base">
          {listing.title}
        </h3>
        <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{metaLine(listing)}</p>
        <p className="mt-1.5 line-clamp-2 flex-1 text-xs text-muted-foreground/80">
          {listing.description}
        </p>

        {!isRent && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {listing.is_digital ? (
              <Badge variant="outline" className="rounded-full text-[10px]">
                Digital
              </Badge>
            ) : (
              <Badge variant="outline" className="rounded-full text-[10px]">
                Physical
              </Badge>
            )}
          </div>
        )}

        <div className="mt-3 flex items-end justify-between gap-2 border-t border-border/40 pt-3">
          <div className="min-w-0">
            {isRent ? (
              <p className="text-lg font-bold text-primary">
                {listing.daily_rental_price != null
                  ? `${formatInr(Number(listing.daily_rental_price))}`
                  : "—"}
                {listing.daily_rental_price != null ? (
                  <span className="text-xs font-medium text-muted-foreground"> / day</span>
                ) : null}
              </p>
            ) : (
              <p className="text-lg font-bold text-primary">
                {listing.is_free ? "Free" : "Paid"}
              </p>
            )}
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <Avatar className="h-7 w-7 ring-2 ring-background">
            <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
              {sellerInitials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-foreground">Student</p>
            <p className="text-[10px] text-muted-foreground">{timeAgo(listing.created_at)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
