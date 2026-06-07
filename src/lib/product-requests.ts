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

export type ProductRequestStatus = "pending" | "accepted" | "rejected" | "completed" | "cancelled";
export type ProductRequestType = "buy" | "offer";

export type ProductRequestRow = {
  id: string;
  product_id: string;
  buyer_id: string;
  seller_id: string;
  request_type: ProductRequestType;
  offered_price: number | null;
  message: string | null;
  status: ProductRequestStatus;
  created_at: string;
  updated_at: string;
};

export type ProductRequestDetails = ProductRequestRow & {
  product?: {
    id: string;
    title: string;
    price: number;
    status: string;
    coverUrl: string | null;
  };
  buyer?: { display_name: string; avatar_url: string | null; hostel_block: string | null };
  seller?: { display_name: string; avatar_url: string | null; hostel_block: string | null };
};

const REQUESTS_TABLE = "product_requests" as unknown as keyof Database["public"]["Tables"];
const PRODUCTS_TABLE = "product_listings" as unknown as keyof Database["public"]["Tables"];
const PRODUCT_IMAGES_TABLE = "product_images" as unknown as keyof Database["public"]["Tables"];

async function enrichProductRequests(rows: ProductRequestRow[]): Promise<ProductRequestDetails[]> {
  if (!rows.length) return [];

  const productIds = [...new Set(rows.map((r) => r.product_id))];
  const userIds = [...new Set(rows.flatMap((r) => [r.buyer_id, r.seller_id]))];

  const [{ data: products }, { data: images }, { data: profiles }] = await Promise.all([
    supabase.from(PRODUCTS_TABLE).select("id,title,price,status").in("id", productIds),
    supabase
      .from(PRODUCT_IMAGES_TABLE)
      .select("product_id,storage_path,sort_index")
      .in("product_id", productIds),
    supabase.from("profiles").select("id,full_name,avatar_url,hostel_block").in("id", userIds),
  ]);

  const imageMap = new Map<string, string>();
  for (const img of images ?? []) {
    const row = img as { product_id: string; storage_path: string; sort_index: number };
    if (!imageMap.has(row.product_id)) {
      imageMap.set(
        row.product_id,
        supabase.storage.from("product-images").getPublicUrl(row.storage_path).data.publicUrl,
      );
    }
  }

  const profileMap = new Map(
    (profiles ?? []).map((p: { id: string; full_name: string | null; avatar_url: string | null; hostel_block: string | null }) => [
      p.id,
      { display_name: p.full_name ?? "Student", avatar_url: p.avatar_url, hostel_block: p.hostel_block },
    ]),
  );

  return rows.map((r) => {
    const product = (products ?? []).find((x: { id: string }) => x.id === r.product_id) as
      | { id: string; title: string; price: number; status: string }
      | undefined;
    return {
      ...r,
      offered_price: r.offered_price != null ? Number(r.offered_price) : null,
      product: product
        ? {
            ...product,
            price: Number(product.price),
            coverUrl: imageMap.get(product.id) ?? null,
          }
        : undefined,
      buyer: profileMap.get(r.buyer_id),
      seller: profileMap.get(r.seller_id),
    };
  });
}

export function useSellerProductRequests(sellerId: string | null | undefined) {
  return useQuery({
    queryKey: ["product_requests", "seller", sellerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(REQUESTS_TABLE)
        .select("*")
        .eq("seller_id", sellerId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return enrichProductRequests((data ?? []) as unknown as ProductRequestRow[]);
    },
    enabled: Boolean(sellerId),
  });
}

export function useBuyerProductRequests(buyerId: string | null | undefined) {
  return useQuery({
    queryKey: ["product_requests", "buyer", buyerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(REQUESTS_TABLE)
        .select("*")
        .eq("buyer_id", buyerId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return enrichProductRequests((data ?? []) as unknown as ProductRequestRow[]);
    },
    enabled: Boolean(buyerId),
  });
}

export function useProductRequestForListing(
  productId: string | undefined,
  buyerId: string | null | undefined,
) {
  return useQuery({
    queryKey: ["product_request", productId, buyerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(REQUESTS_TABLE)
        .select("*")
        .eq("product_id", productId!)
        .eq("buyer_id", buyerId!)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as unknown as ProductRequestRow | null;
    },
    enabled: Boolean(productId && buyerId),
  });
}

export function useCreateProductRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      productId: string;
      buyerId: string;
      sellerId: string;
      productTitle: string;
      requestType: ProductRequestType;
      offeredPrice?: number;
      message?: string;
      buyerName?: string;
      buyerHostel?: string;
    }) => {
      const { data, error } = await supabase
        .from(REQUESTS_TABLE)
        .insert({
          product_id: input.productId,
          buyer_id: input.buyerId,
          seller_id: input.sellerId,
          request_type: input.requestType,
          offered_price: input.offeredPrice ?? null,
          message: input.message?.trim() || null,
          status: "pending",
        })
        .select("id")
        .single();
      if (error) throw error;

      const actionLabel = input.requestType === "offer" ? "offer" : "purchase request";
      const buyerDetails = input.buyerName ? ` from ${input.buyerName}${input.buyerHostel ? ` (${input.buyerHostel})` : ""}` : "";
      await createNotification({
        userId: input.sellerId,
        title: "New Purchase Request",
        description: `You received a ${actionLabel} for "${input.productTitle}"${buyerDetails}.`,
        priority: "important",
        module: "marketplace",
        actionUrl: "/requests",
        metadata: { requestId: data.id, productId: input.productId },
      });

      return data;
    },
    onSuccess: (_, vars) => {
      void queryClient.invalidateQueries({ queryKey: ["product_requests"] });
      void queryClient.invalidateQueries({
        queryKey: ["product_request", vars.productId, vars.buyerId],
      });
      toast.success(vars.requestType === "offer" ? "Offer sent!" : "Purchase request sent!");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Could not send request");
    },
  });
}

export function useUpdateProductRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      requestId: string;
      status: ProductRequestStatus;
      productId?: string;
      productTitle?: string;
      notifyUserId?: string;
      notificationTitle?: string;
      notificationDescription?: string;
      markSold?: boolean;
    }): Promise<ChatMutationResult> => {
      console.log("[useUpdateProductRequest] Called with:", { requestId: input.requestId, status: input.status });
      let conversationId: string | undefined;
      const { error } = await supabase
        .from(REQUESTS_TABLE)
        .update({ status: input.status })
        .eq("id", input.requestId);
      if (error) {
        console.error("[useUpdateProductRequest] Status update error:", error);
        throw error;
      }
      console.log("[useUpdateProductRequest] Status updated to:", input.status);

      if (input.markSold && input.productId) {
        const { error: productErr } = await supabase
          .from(PRODUCTS_TABLE)
          .update({ status: "sold" })
          .eq("id", input.productId);
        if (productErr) throw productErr;
      }

      if (input.notifyUserId && input.notificationTitle && input.notificationDescription) {
        try {
          await createNotification({
            userId: input.notifyUserId,
            title: input.notificationTitle,
            description: input.notificationDescription,
            priority: input.status === "rejected" ? "important" : "informational",
            module: "marketplace",
            actionUrl: "/requests",
            metadata: { requestId: input.requestId, productId: input.productId },
          });
        } catch (notifErr) {
          console.error("[useUpdateProductRequest] Notification creation failed (non-blocking):", notifErr);
        }
      }

      if (input.status === "accepted" || input.status === "completed") {
        console.log("[useUpdateProductRequest] Status is accepted/completed, fetching request row");
        const { data: reqRow } = await supabase
          .from(REQUESTS_TABLE)
          .select("buyer_id,seller_id,product_id")
          .eq("id", input.requestId)
          .maybeSingle();

        console.log("[useUpdateProductRequest] Request row:", reqRow);

        if (reqRow) {
          const row = reqRow as { buyer_id: string; seller_id: string; product_id: string };
          const { data: product } = await supabase
            .from(PRODUCTS_TABLE)
            .select("title")
            .eq("id", row.product_id)
            .maybeSingle();
          const title = (product as { title: string } | null)?.title ?? "Product listing";

          console.log("[useUpdateProductRequest] Product title:", title);

          if (input.status === "accepted") {
            console.log("[useUpdateProductRequest] Calling ensureConversationOnAccept");
            conversationId = await ensureConversationOnAccept({
              buyerId: row.buyer_id,
              sellerId: row.seller_id,
              contextType: "product",
              contextId: row.product_id,
              requestId: input.requestId,
              listingTitle: title,
              notifyBuyer: true,
            });
            console.log("[useUpdateProductRequest] Conversation ID returned:", conversationId);
          } else {
            await completeConversationForRequest({
              buyerId: row.buyer_id,
              contextType: "product",
              contextId: row.product_id,
            });
          }
        } else {
          console.error("[useUpdateProductRequest] Request row not found for ID:", input.requestId);
        }
      }
      console.log("[useUpdateProductRequest] Returning conversationId:", conversationId);
      return { conversationId };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["product_requests"] });
      void queryClient.invalidateQueries({ queryKey: ["product"] });
      invalidateChatQueries(queryClient);
    },
    onError: (err) => {
      console.error("[useUpdateProductRequest] Mutation error:", err);
      toast.error(err instanceof Error ? err.message : "Could not update request");
    },
  });
}

export function isChatUnlockedForProductRequest(status: ProductRequestStatus | undefined) {
  return status === "accepted" || status === "completed";
}
