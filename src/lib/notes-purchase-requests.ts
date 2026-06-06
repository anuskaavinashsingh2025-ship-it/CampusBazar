import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { createNotification } from "@/lib/notifications";

export type NotesPurchaseStatus = "pending" | "accepted" | "rejected" | "completed" | "cancelled";

export type NotesPurchaseRow = {
  id: string;
  notes_listing_id: string;
  buyer_id: string;
  seller_id: string;
  message: string | null;
  status: NotesPurchaseStatus;
  created_at: string;
  updated_at: string;
};

const REQUESTS_TABLE = "notes_purchase_requests" as unknown as keyof Database["public"]["Tables"];

export function useNotesPurchaseForListing(
  notesListingId: string | undefined,
  buyerId: string | null | undefined,
) {
  return useQuery({
    queryKey: ["notes_purchase", notesListingId, buyerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(REQUESTS_TABLE)
        .select("*")
        .eq("notes_listing_id", notesListingId!)
        .eq("buyer_id", buyerId!)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as unknown as NotesPurchaseRow | null;
    },
    enabled: Boolean(notesListingId && buyerId),
  });
}

export function useSellerNotesPurchases(sellerId: string | null | undefined) {
  return useQuery({
    queryKey: ["notes_purchases", "seller", sellerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(REQUESTS_TABLE)
        .select("*")
        .eq("seller_id", sellerId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as NotesPurchaseRow[];
    },
    enabled: Boolean(sellerId),
  });
}

export function useBuyerNotesPurchases(buyerId: string | null | undefined) {
  return useQuery({
    queryKey: ["notes_purchases", "buyer", buyerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(REQUESTS_TABLE)
        .select("*")
        .eq("buyer_id", buyerId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as NotesPurchaseRow[];
    },
    enabled: Boolean(buyerId),
  });
}

export function useCreateNotesPurchase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      notesListingId: string;
      buyerId: string;
      sellerId: string;
      listingTitle: string;
      message?: string;
    }) => {
      const { data, error } = await supabase
        .from(REQUESTS_TABLE)
        .insert({
          notes_listing_id: input.notesListingId,
          buyer_id: input.buyerId,
          seller_id: input.sellerId,
          message: input.message?.trim() || null,
          status: "pending",
        })
        .select("id")
        .single();
      if (error) throw error;

      await createNotification({
        userId: input.sellerId,
        title: "Notes Purchase Request",
        description: `You received a request for "${input.listingTitle}".`,
        priority: "important",
        module: "notes",
        actionUrl: "/requests",
        metadata: { requestId: data.id, notesListingId: input.notesListingId },
      });

      return data;
    },
    onSuccess: (_, vars) => {
      void queryClient.invalidateQueries({ queryKey: ["notes_purchases"] });
      void queryClient.invalidateQueries({
        queryKey: ["notes_purchase", vars.notesListingId, vars.buyerId],
      });
      toast.success("Request sent!");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Could not send request");
    },
  });
}

export function useUpdateNotesPurchase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      requestId: string;
      status: NotesPurchaseStatus;
      notifyUserId?: string;
      notificationTitle?: string;
      notificationDescription?: string;
    }) => {
      const { error } = await supabase
        .from(REQUESTS_TABLE)
        .update({ status: input.status })
        .eq("id", input.requestId);
      if (error) throw error;

      if (input.notifyUserId && input.notificationTitle && input.notificationDescription) {
        await createNotification({
          userId: input.notifyUserId,
          title: input.notificationTitle,
          description: input.notificationDescription,
          priority: input.status === "rejected" ? "important" : "informational",
          module: "notes",
          actionUrl: "/requests",
          metadata: { requestId: input.requestId },
        });
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notes_purchases"] });
      void queryClient.invalidateQueries({ queryKey: ["notes_listing"] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Could not update request");
    },
  });
}

export function isChatUnlockedForNotesPurchase(status: NotesPurchaseStatus | undefined) {
  return status === "accepted" || status === "completed";
}
