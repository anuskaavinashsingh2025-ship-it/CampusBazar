import { useState } from "react";
import { Flag, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/lib/auth";
import { reportTargetFromItemType, submitListingReport, uploadReportEvidence } from "@/lib/listing-reports";
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

const CATEGORIES = [
  "Scam",
  "Spam",
  "Fake Listing",
  "Offensive",
  "Misleading",
  "Payment Issue",
  "Other",
];

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
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [details, setDetails] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!user) {
      toast.error("Please login to report.");
      return;
    }
    setSubmitting(true);
    try {
      // Upload evidence files first (if any)
      let evidenceUrls: string[] | undefined;
      if (files.length > 0) {
        const uploads = await Promise.all(
          files.slice(0, 5).map((f) => uploadReportEvidence(user.id, f)),
        );
        evidenceUrls = uploads.filter(Boolean) as string[];
      }

      await submitListingReport({
        reporterId: user.id,
        targetType: reportTargetFromItemType(itemType),
        itemId,
        category,
        details: details.trim(),
        evidenceUrls,
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
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Detailed description (required)</Label>
            <Textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder={`Describe the issue in detail (max 1000 characters)`}
              maxLength={1000}
              required
            />
            <div className="space-y-1">
              <Label>Attach evidence (images only, up to 5)</Label>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => {
                  const list = e.target.files;
                  if (!list) return;
                  const arr = Array.from(list).slice(0, 5);
                  setFiles(arr);
                }}
              />
              {files.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {files.map((f, i) => (
                    <img
                      key={i}
                      src={URL.createObjectURL(f)}
                      alt={f.name}
                      className="h-16 w-16 object-cover rounded border"
                    />
                  ))}
                </div>
              )}
            </div>
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
