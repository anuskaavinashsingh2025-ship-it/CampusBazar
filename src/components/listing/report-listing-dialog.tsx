import { useState } from "react";
import { Flag, Loader2, X, Upload } from "lucide-react";
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
const MAX_EVIDENCE_IMAGES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_FILE_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp"];

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
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [evidencePreviews, setEvidencePreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    if (evidenceFiles.length + files.length > MAX_EVIDENCE_IMAGES) {
      toast.error(`Maximum ${MAX_EVIDENCE_IMAGES} images allowed`);
      return;
    }

    const validFiles: File[] = [];
    const previews: string[] = [];

    for (const file of files) {
      // Validate file type
      if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        toast.error(`Invalid file type: ${file.name}. Allowed: PNG, JPG, JPEG, WEBP`);
        continue;
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`File too large: ${file.name}. Maximum size is 10MB`);
        continue;
      }

      validFiles.push(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        previews.push(e.target?.result as string);
        if (previews.length === validFiles.length) {
          setEvidencePreviews([...evidencePreviews, ...previews]);
        }
      };
      reader.readAsDataURL(file);
    }

    setEvidenceFiles([...evidenceFiles, ...validFiles]);
  };

  const removeEvidence = (index: number) => {
    setEvidenceFiles(evidenceFiles.filter((_, i) => i !== index));
    setEvidencePreviews(evidencePreviews.filter((_, i) => i !== index));
  };

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
        evidenceFiles: evidenceFiles.length > 0 ? evidenceFiles : undefined,
      });
      toast.success("Report submitted.");
      setOpen(false);
      setDetails("");
      setEvidenceFiles([]);
      setEvidencePreviews([]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not submit report");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDialogClose = () => {
    setOpen(false);
    setDetails("");
    setEvidenceFiles([]);
    setEvidencePreviews([]);
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogClose}>
      <DialogTrigger asChild>
        <Button variant="ghost" className={triggerClassName ?? "gap-2 text-muted-foreground"}>
          <Flag className="h-4 w-4" />
          Report
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
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
          <div className="space-y-2">
            <Label>Evidence Screenshots (optional, max {MAX_EVIDENCE_IMAGES})</Label>
            <div className="flex items-center gap-2">
              <input
                type="file"
                id="evidence-upload"
                multiple
                accept="image/png,image/jpeg,image/jpg,image/webp"
                onChange={handleFileSelect}
                className="hidden"
                disabled={evidenceFiles.length >= MAX_EVIDENCE_IMAGES || submitting}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => document.getElementById('evidence-upload')?.click()}
                disabled={evidenceFiles.length >= MAX_EVIDENCE_IMAGES || submitting}
                className="w-full"
              >
                <Upload className="mr-2 h-4 w-4" />
                {evidenceFiles.length >= MAX_EVIDENCE_IMAGES
                  ? `Maximum ${MAX_EVIDENCE_IMAGES} images reached`
                  : "Upload Screenshots"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Accepted: PNG, JPG, JPEG, WEBP (max 10MB each)
            </p>
            {evidencePreviews.length > 0 && (
              <div className="grid grid-cols-5 gap-2">
                {evidencePreviews.map((preview, index) => (
                  <div key={index} className="relative aspect-square">
                    <img
                      src={preview}
                      alt={`Evidence ${index + 1}`}
                      className="h-full w-full rounded-md object-cover"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute -right-2 -top-2 h-6 w-6 rounded-full"
                      onClick={() => removeEvidence(index)}
                      disabled={submitting}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleDialogClose} disabled={submitting}>
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
