import { useState } from "react";
import { Flag, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/lib/auth";
import { reportTargetFromItemType, submitListingReport } from "@/lib/listing-reports";
import type { WishlistItemType } from "@/lib/wishlist";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const REASONS = ["scam", "spam", "fake", "offensive", "misleading", "other"];

type ReportListingDialogProps = {
  itemType: WishlistItemType;
  itemId: string;
  triggerClassName?: string;
};

export function ReportListingDialog({
  itemType,
  itemId,
  triggerClassName,
}: ReportListingDialogProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("scam");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!user) {
      toast.error("Please login to report.");
      return;
    }
    setSubmitting(true);
    try {
      await submitListingReport({
        reporterId: user.id,
        targetType: reportTargetFromItemType(itemType),
        itemId,
        reason,
        details: details.trim() || undefined,
      });
      toast.success("Report submitted.");
      setOpen(false);
      setDetails("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not submit report");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" className={triggerClassName ?? "gap-2 text-muted-foreground"}>
          <Flag className="h-4 w-4" />
          Report
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report listing</DialogTitle>
          <DialogDescription>
            Tell us what&apos;s wrong. Our team will review this report.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r.charAt(0).toUpperCase() + r.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Details (optional)</Label>
            <Textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Additional context..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Submit report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
