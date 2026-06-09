import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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

type BanDuration = "7" | "30" | "90" | "permanent";

type BanModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetUserId: string;
  targetUserName?: string;
  reportContext?: {
    reportId: string;
    targetType: string;
    reporterId: string;
    sellerUserId: string | null;
  } | null;
  onBanned?: () => Promise<void> | void;
};

export function BanModal({
  open,
  onOpenChange,
  targetUserId,
  targetUserName,
  reportContext,
  onBanned,
}: BanModalProps) {
  const { user } = useAuth();
  const [duration, setDuration] = useState<BanDuration>("7");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!user) {
      toast.error("You must be logged in to ban users");
      return;
    }

    if (!targetUserId) {
      toast.error("Cannot ban user: missing target user id.");
      console.error("[BanModal] Missing target user id", {
        reportId: reportContext?.reportId ?? null,
        targetType: reportContext?.targetType ?? null,
        reporterId: reportContext?.reporterId ?? null,
        sellerUserId: reportContext?.sellerUserId ?? null,
        finalUserIdBeingBanned: targetUserId,
      });
      return;
    }

    if (reportContext && targetUserId !== reportContext.sellerUserId) {
      toast.error("Cannot ban user: selected target is not the reported seller.");
      console.error("[BanModal] Refusing to ban non-seller target", {
        reportId: reportContext.reportId,
        targetType: reportContext.targetType,
        reporterId: reportContext.reporterId,
        sellerUserId: reportContext.sellerUserId,
        finalUserIdBeingBanned: targetUserId,
      });
      return;
    }

    if (!reason.trim()) {
      toast.error("Please provide a reason for the ban");
      return;
    }

    setSubmitting(true);
    try {
      // Calculate banned_until based on duration
      let bannedUntil: string | null = null;
      if (duration !== "permanent") {
        const days = parseInt(duration);
        const date = new Date();
        date.setDate(date.getDate() + days);
        bannedUntil = date.toISOString();
      }

      // Update user profile with ban information
      const bannedAt = new Date().toISOString();
      const updatePayload = {
        status: "banned",
        banned_at: bannedAt,
        banned_until: bannedUntil,
        ban_reason: reason.trim(),
        banned_by: user.id,
      };

      console.log("[BanModal] Updating profile ban status", {
        reportId: reportContext?.reportId ?? null,
        targetType: reportContext?.targetType ?? null,
        reporterId: reportContext?.reporterId ?? null,
        sellerUserId: reportContext?.sellerUserId ?? null,
        finalUserIdBeingBanned: targetUserId,
        updatePayload,
      });

      const { data: updatedProfile, error } = await supabase
        .from("profiles")
        .update(updatePayload)
        .eq("id", targetUserId)
        .select("id,email,status,banned_at,banned_until,ban_reason,banned_by")
        .single();

      if (error) throw error;
      if (!updatedProfile || updatedProfile.status !== "banned" || !updatedProfile.banned_at) {
        console.error("[BanModal] Profile update did not persist ban fields", {
          reportId: reportContext?.reportId ?? null,
          targetType: reportContext?.targetType ?? null,
          reporterId: reportContext?.reporterId ?? null,
          sellerUserId: reportContext?.sellerUserId ?? null,
          finalUserIdBeingBanned: targetUserId,
          updatedProfile,
        });
        throw new Error("Ban update did not persist on the user profile.");
      }

      console.log("[BanModal] Profile ban update succeeded", {
        reportId: reportContext?.reportId ?? null,
        targetType: reportContext?.targetType ?? null,
        reporterId: reportContext?.reporterId ?? null,
        sellerUserId: reportContext?.sellerUserId ?? null,
        finalUserIdBeingBanned: targetUserId,
        updatedProfile,
      });

      // Log admin action
      const { error: actionError } = await supabase.from("admin_actions" as never).insert({
        admin_user_id: user.id,
        action_type: "ban_user",
        target_user_id: targetUserId,
        notes: `Banned for ${duration === "permanent" ? "permanent" : `${duration} days`}: ${reason.trim()}`,
      } as never);
      if (actionError) throw actionError;

      toast.success(
        `User ${targetUserName ? targetUserName : ""} banned ${duration === "permanent" ? "permanently" : `for ${duration} days`}`
      );
      await onBanned?.();
      onOpenChange(false);
      setReason("");
      setDuration("7");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to ban user");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setReason("");
    setDuration("7");
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ban User</DialogTitle>
          <DialogDescription>
            {targetUserName ? `Ban ${targetUserName}` : "Ban this user"} from the platform.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Duration</Label>
            <Select value={duration} onValueChange={(v) => setDuration(v as BanDuration)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 days</SelectItem>
                <SelectItem value="30">30 days</SelectItem>
                <SelectItem value="90">90 days</SelectItem>
                <SelectItem value="permanent">Permanent</SelectItem>
              </SelectContent>
            </Select>
            {duration === "permanent" && (
              <p className="text-xs text-destructive">
                Permanent bans cannot be undone and will block all platform access.
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Reason *</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why this user is being banned..."
              className="min-h-[100px]"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting} variant="destructive">
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Ban User
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
