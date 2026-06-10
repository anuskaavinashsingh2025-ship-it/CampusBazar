import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import {
  getOrCreateConversation,
  invalidateChatQueries,
} from "@/lib/chat";
import {
  createTransactionNotification,
  viewListingUrl,
  completedActions,
} from "@/lib/transaction-notifications";
import { enforceBanCheck } from "@/lib/ban-enforcement";

const REQUESTS_TABLE = "rental_requests" as unknown as keyof Database["public"]["Tables"];
const RENTALS_TABLE = "rental_listings" as unknown as keyof Database["public"]["Tables"];
const RENTAL_HISTORY_TABLE = "rental_history" as unknown as keyof Database["public"]["Tables"];

// ===== MARK AS RENTED OUT (Seller Action) =====
// Transition: accepted → active_rental
// Only seller can perform this action
export function useMarkAsRentedOut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      requestId: string;
      rentalId: string;
      sellerId: string;
      renterId: string;
      rentalTitle: string;
      durationDays?: number;
    }) => {
      // Backend validation: Only seller can mark as rented out
      const { data: rental } = await supabase
        .from(RENTALS_TABLE)
        .select("seller_id")
        .eq("id", input.rentalId)
        .single();
      
      if (!rental || rental.seller_id !== input.sellerId) {
        throw new Error("Only the seller can mark this item as rented out");
      }

      // Update request status to active_rental
      const { error: requestError } = await supabase
        .from(REQUESTS_TABLE)
        .update({ status: "active_rental" })
        .eq("id", input.requestId);
      
      if (requestError) throw requestError;

      // Update listing status to active_rental
      const { error: listingError } = await supabase
        .from(RENTALS_TABLE)
        .update({ status: "active_rental" })
        .eq("id", input.rentalId);
      
      if (listingError) throw listingError;

      // Create or update rental history entry
      const { data: existingHistory } = await supabase
        .from(RENTAL_HISTORY_TABLE)
        .select("id")
        .eq("request_id", input.requestId)
        .maybeSingle();

      if (existingHistory) {
        await supabase
          .from(RENTAL_HISTORY_TABLE)
          .update({ rented_out_at: new Date().toISOString(), duration_days: input.durationDays })
          .eq("id", existingHistory.id);
      } else {
        await supabase
          .from(RENTAL_HISTORY_TABLE)
          .insert({
            listing_id: input.rentalId,
            listing_type: "rental",
            owner_id: input.sellerId,
            renter_id: input.renterId,
            request_id: input.requestId,
            rented_out_at: new Date().toISOString(),
            duration_days: input.durationDays,
          });
      }

      // Send notification to renter
      const conversationId = await getOrCreateConversation({
        buyerId: input.renterId,
        sellerId: input.sellerId,
        contextType: "rental",
        contextId: input.rentalId,
        requestId: input.requestId,
        listingTitle: input.rentalTitle,
      });

      const listingUrl = viewListingUrl("rentals", input.rentalId);
      
      await createTransactionNotification({
        receiverId: input.renterId,
        senderId: input.sellerId,
        title: "Rental Started",
        description: "Your rental has been marked as active. Enjoy your rental!",
        priority: "important",
        module: "rentals",
        actionUrl: `/chats/${conversationId}`,
        actions: [
          {
            label: "View Chat",
            url: `/chats/${conversationId}`,
          },
        ],
        conversationId,
        relatedEntityId: input.requestId,
        listingId: input.rentalId,
        requestId: input.requestId,
        renterId: input.renterId,
      });

      return { conversationId };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["rental_requests"] });
      void queryClient.invalidateQueries({ queryKey: ["rentals"] });
      void queryClient.invalidateQueries({ queryKey: ["rental"] });
      invalidateChatQueries(queryClient);
      toast.success("Rental marked as active!");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Could not mark as rented out");
    },
  });
}

// ===== RETURN ITEM (Renter Action) =====
// Transition: active_rental → return_requested
// Only renter can perform this action
export function useReturnItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      requestId: string;
      rentalId: string;
      renterId: string;
      sellerId: string;
      rentalTitle: string;
    }) => {
      await enforceBanCheck(input.renterId, "return a rental item");

      // Backend validation: Only renter can return item
      const { data: request } = await supabase
        .from(REQUESTS_TABLE)
        .select("buyer_id")
        .eq("id", input.requestId)
        .single();
      
      if (!request || request.buyer_id !== input.renterId) {
        throw new Error("Only the renter can return this item");
      }

      // Update request status to return_requested
      const { error: requestError } = await supabase
        .from(REQUESTS_TABLE)
        .update({ status: "return_requested" })
        .eq("id", input.requestId);
      
      if (requestError) throw requestError;

      // Update rental history
      await supabase
        .from(RENTAL_HISTORY_TABLE)
        .update({ return_requested_at: new Date().toISOString() })
        .eq("request_id", input.requestId);

      // Send notification to seller
      const conversationId = await getOrCreateConversation({
        buyerId: input.renterId,
        sellerId: input.sellerId,
        contextType: "rental",
        contextId: input.rentalId,
        requestId: input.requestId,
        listingTitle: input.rentalTitle,
      });

      const listingUrl = viewListingUrl("rentals", input.rentalId);
      
      await createTransactionNotification({
        receiverId: input.sellerId,
        senderId: input.renterId,
        title: "Return Requested",
        description: "The renter has returned the item. Please verify and confirm.",
        priority: "important",
        module: "rentals",
        actionUrl: `/chats/${conversationId}`,
        actions: [
          {
            label: "View Chat",
            url: `/chats/${conversationId}`,
          },
        ],
        conversationId,
        relatedEntityId: input.requestId,
        listingId: input.rentalId,
        requestId: input.requestId,
        renterId: input.renterId,
      });

      return { conversationId };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["rental_requests"] });
      void queryClient.invalidateQueries({ queryKey: ["rentals"] });
      void queryClient.invalidateQueries({ queryKey: ["rental"] });
      invalidateChatQueries(queryClient);
      toast.success("Return requested! Seller will verify.");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Could not request return");
    },
  });
}

// ===== CONFIRM RETURN (Seller Action) =====
// Transition: return_requested → completed
// Only seller can perform this action
export function useConfirmReturn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      requestId: string;
      rentalId: string;
      sellerId: string;
      renterId: string;
      rentalTitle: string;
      makeAvailableAgain: boolean;
    }) => {
      // Backend validation: Only seller can confirm return
      const { data: rental } = await supabase
        .from(RENTALS_TABLE)
        .select("seller_id")
        .eq("id", input.rentalId)
        .single();
      
      if (!rental || rental.seller_id !== input.sellerId) {
        throw new Error("Only the seller can confirm the return");
      }

      // Update request status to completed
      const { error: requestError } = await supabase
        .from(REQUESTS_TABLE)
        .update({ status: "completed" })
        .eq("id", input.requestId);
      
      if (requestError) throw requestError;

      // Update listing status based on seller's choice
      const newListingStatus = input.makeAvailableAgain ? "available" : "unavailable";
      const { error: listingError } = await supabase
        .from(RENTALS_TABLE)
        .update({ status: newListingStatus })
        .eq("id", input.rentalId);
      
      if (listingError) throw listingError;

      // Update rental history
      await supabase
        .from(RENTAL_HISTORY_TABLE)
        .update({ completed_at: new Date().toISOString() })
        .eq("request_id", input.requestId);

      // Send notification to renter
      const conversationId = await getOrCreateConversation({
        buyerId: input.renterId,
        sellerId: input.sellerId,
        contextType: "rental",
        contextId: input.rentalId,
        requestId: input.requestId,
        listingTitle: input.rentalTitle,
      });

      const listingUrl = viewListingUrl("rentals", input.rentalId);
      
      await createTransactionNotification({
        receiverId: input.renterId,
        senderId: input.sellerId,
        title: "Rental Completed",
        description: "Your rental has been completed successfully. Thank you!",
        priority: "important",
        module: "rentals",
        actionUrl: `/chats/${conversationId}`,
        actions: completedActions(`/chats/${conversationId}`),
        conversationId,
        relatedEntityId: input.requestId,
        listingId: input.rentalId,
        requestId: input.requestId,
        renterId: input.renterId,
      });

      return { conversationId };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["rental_requests"] });
      void queryClient.invalidateQueries({ queryKey: ["rentals"] });
      void queryClient.invalidateQueries({ queryKey: ["rental"] });
      void queryClient.invalidateQueries({ queryKey: ["rental_history"] });
      invalidateChatQueries(queryClient);
      toast.success("Return confirmed! Rental completed.");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Could not confirm return");
    },
  });
}

// ===== GET RENTAL HISTORY =====
export function useRentalHistory(userId: string | null | undefined) {
  return useQuery({
    queryKey: ["rental_history", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from(RENTAL_HISTORY_TABLE)
        .select("*")
        .or(`owner_id.eq.${userId},renter_id.eq.${userId}`)
        .order("completed_at", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: Boolean(userId),
  });
}

// ===== GET ACTIVE RENTALS FOR SELLER =====
export function useActiveRentalsForSeller(sellerId: string | null | undefined) {
  return useQuery({
    queryKey: ["active_rentals", "seller", sellerId],
    queryFn: async () => {
      if (!sellerId) return [];
      const { data, error } = await supabase
        .from(RENTALS_TABLE)
        .select("*, rental_requests!inner(*)")
        .eq("seller_id", sellerId)
        .eq("status", "active_rental");
      if (error) throw error;
      return data ?? [];
    },
    enabled: Boolean(sellerId),
  });
}

// ===== GET PENDING RETURNS FOR SELLER =====
export function usePendingReturnsForSeller(sellerId: string | null | undefined) {
  return useQuery({
    queryKey: ["pending_returns", "seller", sellerId],
    queryFn: async () => {
      if (!sellerId) return [];
      const { data, error } = await supabase
        .from(RENTALS_TABLE)
        .select("*, rental_requests!inner(*)")
        .eq("seller_id", sellerId)
        .eq("status", "return_requested");
      if (error) throw error;
      return data ?? [];
    },
    enabled: Boolean(sellerId),
  });
}

// ===== GET ACTIVE RENTALS FOR RENTER =====
export function useActiveRentalsForRenter(renterId: string | null | undefined) {
  return useQuery({
    queryKey: ["active_rentals", "renter", renterId],
    queryFn: async () => {
      if (!renterId) return [];
      const { data, error } = await supabase
        .from(RENTALS_TABLE)
        .select("*, rental_requests!inner(*)")
        .eq("rental_requests.buyer_id", renterId)
        .eq("status", "active_rental");
      if (error) throw error;
      return data ?? [];
    },
    enabled: Boolean(renterId),
  });
}
