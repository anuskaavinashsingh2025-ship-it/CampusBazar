import { MessageSquare } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type NotesRequestCardData = {
  id: string;
  subject: string;
  request_type: string;
  description: string;
  urgency_level: string;
};

type NotesRequestCardProps = {
  request: NotesRequestCardData;
  onRespond: () => void;
  onMarkFulfilled: () => void;
  className?: string;
};

function urgencyStyles(level: string) {
  const l = level.toLowerCase();
  if (l.includes("urgent")) return "bg-red-500/10 text-red-700 border-red-200";
  if (l.includes("high")) return "bg-orange-500/10 text-orange-700 border-orange-200";
  if (l.includes("medium")) return "bg-amber-500/10 text-amber-700 border-amber-200";
  return "bg-emerald-500/10 text-emerald-700 border-emerald-200";
}

export function NotesRequestCard({
  request,
  onRespond,
  onMarkFulfilled,
  className,
}: NotesRequestCardProps) {
  return (
    <Card
      className={cn(
        "border-border/40 shadow-sm transition-all duration-200 hover:border-primary/15 hover:shadow-md",
        className,
      )}
    >
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-base font-semibold tracking-tight text-foreground">
              {request.subject}
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">{request.request_type}</p>
          </div>
          <Badge
            variant="outline"
            className={cn("shrink-0 capitalize", urgencyStyles(request.urgency_level))}
          >
            {request.urgency_level}
          </Badge>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground line-clamp-3">
          {request.description}
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button variant="outline" size="sm" className="rounded-full" onClick={onRespond}>
            <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
            Respond
          </Button>
          <Button size="sm" className="rounded-full" onClick={onMarkFulfilled}>
            Mark Fulfilled
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
