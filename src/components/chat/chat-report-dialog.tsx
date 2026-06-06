import { useState } from "react";
import { Flag } from "lucide-react";

import {
  useSubmitChatReport,
  type ChatReportReason,
  type ChatReportTarget,
} from "@/lib/chat";
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

const REASONS: { value: ChatReportReason; label: string }[] = [
  { value: "spam", label: "Spam" },
  { value: "abuse", label: "Abuse" },
  { value: "harassment", label: "Harassment" },
  { value: "scam", label: "Scam Attempt" },
  { value: "fake_listing", label: "Fake Listing" },
  { value: "inappropriate", label: "Inappropriate Content" },
  { value: "other", label: "Other" },
];

type ChatReportDialogProps = {
  userId: string;
  conversationId: string;
  otherUserId: string;
  listingTitle: string;
};

export function ChatReportDialog({
  userId,
  conversationId,
  otherUserId,
  listingTitle,
}: ChatReportDialogProps) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<ChatReportTarget>("conversation");
  const [reason, setReason] = useState<ChatReportReason>("spam");
  const [details, setDetails] = useState("");
  const submit = useSubmitChatReport(userId);

  const handleSubmit = () => {
    submit.mutate(
      {
        conversationId,
        reportTarget: target,
        reportedUserId: target === "user" ? otherUserId : undefined,
        reason,
        details,
        notifyAdmin: true,
        listingTitle,
      },
      { onSuccess: () => setOpen(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1 text-xs">
          <Flag className="h-3.5 w-3.5" />
          Report
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report</DialogTitle>
          <DialogDescription>
            Report a user, conversation, or listing. Evidence will be preserved for moderation.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Report type</Label>
            <Select value={target} onValueChange={(v) => setTarget(v as ChatReportTarget)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">Report User</SelectItem>
                <SelectItem value="conversation">Report Conversation</SelectItem>
                <SelectItem value="listing">Report Listing</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Reason</Label>
            <Select value={reason} onValueChange={(v) => setReason(v as ChatReportReason)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
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
              placeholder="Describe what happened..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submit.isPending}>
            Submit Report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
