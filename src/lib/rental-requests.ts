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

export type RentalRequestStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "returned"
  | "completed"
  | "cancelled";

export type RentalRequestRow = {
  id: string;
  rental_id: string;
  buyer_id: string;
  seller_id: string;
  status: RentalRequestStatus;
  message: string | null;
  created_at: string;
  updated_at: string;
};

export type RentalRequestDetails = RentalRequestRow & {
  rental?: {
    id: string;
    title: string;
    rent_price_per_day: number;
    status: string;
    coverUrl: string | null;
  };
  buyer?: { display_name: string; avatar_url: string | null; hostel_block: string | null };
  seller?: { display_name: string; avatar_url: string | null; hostel_block: string | null };
};

const REQUESTS_TABLE = "rental_requests" as unknown as keyof Database["public"]["Tables"];
const RENTALS_TABLE = "rental_listings" as unknown as keyof Database["public"]["Tables"];
const RENTAL_IMAGES_TABLE = "rental_images" as unknown as keyof Database["public"]["Tables"];

export type RentalRequestFormData = {
  rentalDurationDays: number;
  pickupDate: string;
  pickupLocation: string;
  message: string;
};

export function formatRentalRequestMessage(data: RentalRequestFormData): string {
  const parts = [
    `Rental Duration: ${data.rentalDurationDays} day${data.rentalDurationDays === 1 ? "" : "s"}`,
    `Pickup Date: ${data.pickupDate}`,
    `Pickup Location: ${data.pickupLocation}`,
  ];
  if (data.message.trim()) parts.push(`Message: ${data.message.trim()}`);
  return parts.join("\n");
}

export function parseRentalRequestMessage(message: string | null) {
  if (!message) return { duration: "", pickupDate: "", pickupLocation: "", personalMessage: "" };
  const lines = message.split("\n");
  const result = { duration: "", pickupDate: "", pickupLocation: "", personalMessage: "" };
  for (const line of lines) {
    if (line.startsWith("Rental Duration:")) result.duration = line.replace("Rental Duration:", "").trim();
    else if (line.startsWith("Pickup Date:")) result.pickupDate = line.replace("Pickup Date:", "").trim();
    else if (line.startsWith("Pickup Location:"))
      result.pickupLocation = line.replace("Pickup Location:", "").trim();
    else if (line.startsWith("Message:")) result.personalMessage = line.replace("Message:", "").trim();
  }
  return result;
}

async function enrichRequests(rows: RentalRequestRow[]): Promise<RentalRequestDetails[]> {
  if (!rows.length) return [];

  const rentalIds = [...new Set(rows.map((r) => r.rental_id))];
  const userIds = [...new Set(rows.flatMap((r) => [r.buyer_id, r.seller_id]))];

  const [{ data: rentals }, { data: images }, { data: profiles }] = await Promise.all([
    supabase
      .from(RENTALS_TABLE)
      .select("id,title,rent_price_per_day,status")
      .in("id", rentalIds),
    supabase
      .from(RENTAL_IMAGES_TABLE)
      .select("rental_id,storage_path,sort_index")
      .in("rental_id", rentalIds),
    supabase
      .from("profiles")
      .select("id,full_name,avatar_url,hostel_block")
      .in("id", userIds),
  ]);

  const imageMap = new Map<string, string>();
  for (const img of images ?? []) {
    const row = img as { rental_id: string; storage_path: string; sort_index: number };
    if (!imageMap.has(row.rental_id)) {
      imageMap.set(
        row.rental_id,
        supabase.storage.from("rental-images").getPublicUrl(row.storage_path).data.publicUrl,
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
    const rental = (rentals ?? []).find((x: { id: string }) => x.id === r.rental_id) as
      | { id: string; title: string; rent_price_per_day: number; status: string }
      | undefined;
    return {
      ...r,
      rental: rental
        ? {
            ...rental,
            rent_price_per_day: Number(rental.rent_price_per_day),
            coverUrl: imageMap.get(rental.id) ?? null,
          }
        : undefined,
      buyer: profileMap.get(r.buyer_id),
      seller: profileMap.get(r.seller_id),
    };
  });
}

export function useSellerRentalRequests(sellerId: string | null | undefined) {
  return useQuery({
    queryKey: ["rental_requests", "seller", sellerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(REQUESTS_TABLE)
        .select("*")
        .eq("seller_id", sellerId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return enrichRequests((data ?? []) as unknown as RentalRequestRow[]);
    },
    enabled: Boolean(sellerId),
    refetchInterval: 10000,
  });
}

export function useRentalRequestForListing(
  rentalId: string | undefined,
  buyerId: string | null | undefined,
) {
  return useQuery({
    queryKey: ["rental_request", rentalId, buyerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(REQUESTS_TABLE)
        .select("*")
        .eq("rental_id", rentalId!)
        .eq("buyer_id", buyerId!)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as unknown as RentalRequestRow | null;
    },
    enabled: Boolean(rentalId && buyerId),
  });
}

export function useBuyerRentalRequests(buyerId: string | null | undefined) {
  return useQuery({
    queryKey: ["rental_requests", "buyer", buyerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(REQUESTS_TABLE)
        .select("*")
        .eq("buyer_id", buyerId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return enrichRequests((data ?? []) as unknown as RentalRequestRow[]);
    },
    enabled: Boolean(buyerId),
    refetchInterval: 10000,
  });
}

export function useCreateRentalRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      rentalId: string;
      buyerId: string;
      sellerId: string;
      rentalTitle: string;
      form: RentalRequestFormData;
      buyerName?: string;
      buyerHostel?: string;
    }) => {
      const message = formatRentalRequestMessage(input.form);
      const { data, error } = await supabase
        .from(REQUESTS_TABLE)
        .insert({
          rental_id: input.rentalId,
          buyer_id: input.buyerId,
          seller_id: input.sellerId,
          status: "pending",
          message,
        })
        .select("id")
        .single();
      if (error) throw error;

      const buyerDetails = input.buyerName ? ` from ${input.buyerName}${input.buyerHostel ? ` (${input.buyerHostel})` : ""}` : "";
      await createNotification({
        userId: input.sellerId,
        title: "Rental Request Received",
        description: `You received a rental request for "${input.rentalTitle}"${buyerDetails}.`,
        priority: "important",
        module: "rentals",
        actionUrl: "/requests",
        metadata: { requestId: data.id, rentalId: input.rentalId },
      });

      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["rental_requests"] });
      toast.success("Rental request sent!");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Could not send rental request");
    },
  });
}

export function isChatUnlockedForRentalRequest(status: RentalRequestStatus | undefined) {
  return status === "accepted" || status === "returned" || status === "completed";
}

export function useUpdateRentalRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      requestId: string;
      status: RentalRequestStatus;
      rentalId?: string;
      rentalTitle?: string;
      notifyUserId?: string;
      notificationTitle?: string;
      notificationDescription?: string;
      listingStatus?: "available" | "rented_out" | "unavailable";
    }): Promise<ChatMutationResult> => {
      console.log("[useUpdateRentalRequest] Called with:", { requestId: input.requestId, status: input.status });
      let conversationId: string | undefined;
      const { error } = await supabase
        .from(REQUESTS_TABLE)
        .update({ status: input.status })
        .eq("id", input.requestId);
      if (error) {
        console.error("[useUpdateRentalRequest] Status update error:", error);
        throw error;
      }
      console.log("[useUpdateRentalRequest] Status updated to:", input.status);

      if (input.listingStatus && input.rentalId) {
        const { error: listingErr } = await supabase
          .from(RENTALS_TABLE)
          .update({ status: input.listingStatus })
          .eq("id", input.rentalId);
        if (listingErr) throw listingErr;
      }

      if (input.notifyUserId && input.notificationTitle && input.notificationDescription) {
        try {
          await createNotification({
            userId: input.notifyUserId,
            title: input.notificationTitle,
            description: input.notificationDescription,
            priority: input.status === "rejected" ? "important" : "informational",
            module: "rentals",
            actionUrl: "/requests",
            metadata: { requestId: input.requestId, rentalId: input.rentalId },
          });
        } catch (notifErr) {
          console.error("[useUpdateRentalRequest] Notification creation failed (non-blocking):", notifErr);
        }
      }

      if (input.status === "accepted" || input.status === "completed") {
        console.log("[useUpdateRentalRequest] Status is accepted/completed, fetching request row");
        const { data: reqRow } = await supabase
          .from(REQUESTS_TABLE)
          .select("buyer_id,seller_id,rental_id")
          .eq("id", input.requestId)
          .maybeSingle();

        console.log("[useUpdateRentalRequest] Request row:", reqRow);

        if (reqRow) {
          const row = reqRow as { buyer_id: string; seller_id: string; rental_id: string };
          const { data: rental } = await supabase
            .from(RENTALS_TABLE)
            .select("title")
            .eq("id", row.rental_id)
            .maybeSingle();
          const title = (rental as { title: string } | null)?.title ?? input.rentalTitle ?? "Rental listing";

          console.log("[useUpdateRentalRequest] Rental title:", title);

          if (input.status === "accepted") {
            console.log("[useUpdateRentalRequest] Calling ensureConversationOnAccept");
            conversationId = await ensureConversationOnAccept({
              buyerId: row.buyer_id,
              sellerId: row.seller_id,
              contextType: "rental",
              contextId: row.rental_id,
              requestId: input.requestId,
              listingTitle: title,
              notifyBuyer: true,
            });
            console.log("[useUpdateRentalRequest] Conversation ID returned:", conversationId);
          } else {
            await completeConversationForRequest({
              buyerId: row.buyer_id,
              contextType: "rental",
              contextId: row.rental_id,
            });
          }
        } else {
          console.error("[useUpdateRentalRequest] Request row not found for ID:", input.requestId);
        }
      }
      console.log("[useUpdateRentalRequest] Returning conversationId:", conversationId);
      return { conversationId };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["rental_requests"] });
      void queryClient.invalidateQueries({ queryKey: ["rentals"] });
      void queryClient.invalidateQueries({ queryKey: ["rental"] });
      invalidateChatQueries(queryClient);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Could not update request");
    },
  });
}
