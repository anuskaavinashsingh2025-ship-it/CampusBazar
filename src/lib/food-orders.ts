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

export type FoodOrderStatus = "pending" | "accepted" | "rejected" | "completed" | "cancelled";

export type FoodOrderRow = {
  id: string;
  food_listing_id: string;
  buyer_id: string;
  seller_id: string;
  quantity: number;
  message: string | null;
  status: FoodOrderStatus;
  created_at: string;
  updated_at: string;
};

const ORDERS_TABLE = "food_orders" as unknown as keyof Database["public"]["Tables"];
const FOOD_LISTINGS_TABLE = "food_listings" as unknown as keyof Database["public"]["Tables"];

export function useFoodOrderForListing(
  foodListingId: string | undefined,
  buyerId: string | null | undefined,
) {
  return useQuery({
    queryKey: ["food_order", foodListingId, buyerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(ORDERS_TABLE)
        .select("*")
        .eq("food_listing_id", foodListingId!)
        .eq("buyer_id", buyerId!)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as unknown as FoodOrderRow | null;
    },
    enabled: Boolean(foodListingId && buyerId),
  });
}

export function useSellerFoodOrders(sellerId: string | null | undefined) {
  return useQuery({
    queryKey: ["food_orders", "seller", sellerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(ORDERS_TABLE)
        .select("*")
        .eq("seller_id", sellerId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as FoodOrderRow[];
    },
    enabled: Boolean(sellerId),
  });
}

export function useBuyerFoodOrders(buyerId: string | null | undefined) {
  return useQuery({
    queryKey: ["food_orders", "buyer", buyerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(ORDERS_TABLE)
        .select("*")
        .eq("buyer_id", buyerId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as FoodOrderRow[];
    },
    enabled: Boolean(buyerId),
  });
}

export function useCreateFoodOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      foodListingId: string;
      buyerId: string;
      sellerId: string;
      productName: string;
      quantity?: number;
      message?: string;
    }) => {
      const { data, error } = await supabase
        .from(ORDERS_TABLE)
        .insert({
          food_listing_id: input.foodListingId,
          buyer_id: input.buyerId,
          seller_id: input.sellerId,
          quantity: input.quantity ?? 1,
          message: input.message?.trim() || null,
          status: "pending",
        })
        .select("id")
        .single();
      if (error) throw error;

      await createNotification({
        userId: input.sellerId,
        title: "Food Order Received",
        description: `You received an order for "${input.productName}".`,
        priority: "important",
        module: "food",
        actionUrl: "/requests",
        metadata: { orderId: data.id, foodListingId: input.foodListingId },
      });

      return data;
    },
    onSuccess: (_, vars) => {
      void queryClient.invalidateQueries({ queryKey: ["food_orders"] });
      void queryClient.invalidateQueries({
        queryKey: ["food_order", vars.foodListingId, vars.buyerId],
      });
      toast.success("Order placed!");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Could not place order");
    },
  });
}

export function useUpdateFoodOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      orderId: string;
      status: FoodOrderStatus;
      notifyUserId?: string;
      notificationTitle?: string;
      notificationDescription?: string;
    }): Promise<ChatMutationResult> => {
      let conversationId: string | undefined;
      const { error } = await supabase
        .from(ORDERS_TABLE)
        .update({ status: input.status })
        .eq("id", input.orderId);
      if (error) throw error;

      if (input.notifyUserId && input.notificationTitle && input.notificationDescription) {
        await createNotification({
          userId: input.notifyUserId,
          title: input.notificationTitle,
          description: input.notificationDescription,
          priority: input.status === "rejected" ? "important" : "informational",
          module: "food",
          actionUrl: "/requests",
          metadata: { orderId: input.orderId },
        });
      }

      if (input.status === "accepted" || input.status === "completed") {
        const { data: orderRow } = await supabase
          .from(ORDERS_TABLE)
          .select("buyer_id,seller_id,food_listing_id")
          .eq("id", input.orderId)
          .maybeSingle();

        if (orderRow) {
          const row = orderRow as {
            buyer_id: string;
            seller_id: string;
            food_listing_id: string;
          };
          const { data: listing } = await supabase
            .from(FOOD_LISTINGS_TABLE)
            .select("product_name")
            .eq("id", row.food_listing_id)
            .maybeSingle();
          const title =
            (listing as { product_name: string } | null)?.product_name ?? "Food listing";

          if (input.status === "accepted") {
            conversationId = await ensureConversationOnAccept({
              buyerId: row.buyer_id,
              sellerId: row.seller_id,
              contextType: "food",
              contextId: row.food_listing_id,
              requestId: input.orderId,
              listingTitle: title,
              notifyBuyer: true,
            });
          } else {
            await completeConversationForRequest({
              buyerId: row.buyer_id,
              contextType: "food",
              contextId: row.food_listing_id,
            });
          }
        }
      }
      return { conversationId };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["food_orders"] });
      void queryClient.invalidateQueries({ queryKey: ["food"] });
      invalidateChatQueries(queryClient);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Could not update order");
    },
  });
}

export function isChatUnlockedForFoodOrder(status: FoodOrderStatus | undefined) {
  return status === "accepted" || status === "completed";
}
