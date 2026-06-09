import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import {
  completeConversationForRequest,
  ensureConversationOnAccept,
  invalidateChatQueries,
  type ChatMutationResult,
} from "@/lib/chat";
import { createNotification } from "@/lib/notifications";
import { enforceBanCheck } from "@/lib/ban-enforcement";

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
const NOTES_LISTINGS_TABLE = "notes_listings" as unknown as keyof Database["public"]["Tables"];

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
      buyerName?: string;
      buyerHostel?: string;
    }) => {
      await enforceBanCheck(input.buyerId, "create a notes purchase request");
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

      const buyerDetails = input.buyerName
        ? ` from ${input.buyerName}${input.buyerHostel ? ` (${input.buyerHostel})` : ""}`
        : "";
      await createNotification({
        userId: input.sellerId,
        title: "Notes Purchase Request",
        description: `You received a request for "${input.listingTitle}"${buyerDetails}.`,
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
    }): Promise<ChatMutationResult> => {
      console.log("[useUpdateNotesPurchase] Called with:", {
        requestId: input.requestId,
        status: input.status,
      });
      let conversationId: string | undefined;
      const { error } = await supabase
        .from(REQUESTS_TABLE)
        .update({ status: input.status })
        .eq("id", input.requestId);
      if (error) {
        console.error("[useUpdateNotesPurchase] Status update error:", error);
        throw error;
      }
      console.log("[useUpdateNotesPurchase] Status updated to:", input.status);

      if (input.notifyUserId && input.notificationTitle && input.notificationDescription) {
        try {
          await createNotification({
            userId: input.notifyUserId,
            title: input.notificationTitle,
            description: input.notificationDescription,
            priority: input.status === "rejected" ? "important" : "informational",
            module: "notes",
            actionUrl: "/requests",
            metadata: { requestId: input.requestId },
          });
        } catch (notifErr) {
          console.error(
            "[useUpdateNotesPurchase] Notification creation failed (non-blocking):",
            notifErr,
          );
        }
      }

      if (input.status === "accepted" || input.status === "completed") {
        console.log("[useUpdateNotesPurchase] Status is accepted/completed, fetching request row");
        const { data: reqRow } = await supabase
          .from(REQUESTS_TABLE)
          .select("buyer_id,seller_id,notes_listing_id")
          .eq("id", input.requestId)
          .maybeSingle();

        console.log("[useUpdateNotesPurchase] Request row:", reqRow);

        if (reqRow) {
          const row = reqRow as {
            buyer_id: string;
            seller_id: string;
            notes_listing_id: string;
          };
          const { data: listing } = await supabase
            .from(NOTES_LISTINGS_TABLE)
            .select("title")
            .eq("id", row.notes_listing_id)
            .maybeSingle();
          const title = (listing as { title: string } | null)?.title ?? "Notes listing";

          console.log("[useUpdateNotesPurchase] Listing title:", title);

          if (input.status === "accepted") {
            console.log("[useUpdateNotesPurchase] Calling ensureConversationOnAccept");
            conversationId = await ensureConversationOnAccept({
              buyerId: row.buyer_id,
              sellerId: row.seller_id,
              contextType: "notes",
              contextId: row.notes_listing_id,
              requestId: input.requestId,
              listingTitle: title,
              notifyBuyer: true,
            });
            console.log("[useUpdateNotesPurchase] Conversation ID returned:", conversationId);
          } else {
            await completeConversationForRequest({
              buyerId: row.buyer_id,
              contextType: "notes",
              contextId: row.notes_listing_id,
            });
          }
        } else {
          console.error("[useUpdateNotesPurchase] Request row not found for ID:", input.requestId);
        }
      }
      console.log("[useUpdateNotesPurchase] Returning conversationId:", conversationId);
      return { conversationId };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notes_purchases"] });
      void queryClient.invalidateQueries({ queryKey: ["notes_listing"] });
      invalidateChatQueries(queryClient);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Could not update request");
    },
  });
}

export function isChatUnlockedForNotesPurchase(status: NotesPurchaseStatus | undefined) {
  return status === "accepted" || status === "completed";
}
