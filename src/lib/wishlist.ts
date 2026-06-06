import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type WishlistItemType = "product" | "rental" | "food" | "notes";

const WISHLIST_TABLE = "wishlist_items" as unknown as keyof Database["public"]["Tables"];

export type WishlistRow = {
  id: string;
  user_id: string;
  item_type: WishlistItemType;
  item_id: string;
  created_at: string;
};

export const wishlistQueryKey = (userId: string | null) => ["wishlist", userId] as const;

export async function fetchWishlist(userId: string): Promise<WishlistRow[]> {
  const { data, error } = await supabase
    .from(WISHLIST_TABLE)
    .select("id,user_id,item_type,item_id,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as WishlistRow[];
}

export function wishlistKey(userId: string, itemType: WishlistItemType, itemId: string) {
  return `${itemType}:${itemId}`;
}

export function buildWishlistSet(rows: WishlistRow[]) {
  return new Set(rows.map((r) => wishlistKey(r.user_id, r.item_type, r.item_id)));
}

export function useWishlist(userId: string | null | undefined) {
  return useQuery({
    queryKey: wishlistQueryKey(userId ?? null),
    queryFn: () => fetchWishlist(userId!),
    enabled: Boolean(userId),
  });
}

export function useWishlistToggle(userId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      itemType,
      itemId,
      isWishlisted,
    }: {
      itemType: WishlistItemType;
      itemId: string;
      isWishlisted: boolean;
    }) => {
      if (!userId) throw new Error("Login required");

      if (isWishlisted) {
        const { error } = await supabase
          .from(WISHLIST_TABLE)
          .delete()
          .eq("user_id", userId)
          .eq("item_type", itemType)
          .eq("item_id", itemId);
        if (error) throw error;
        return false;
      }

      const { error } = await supabase.from(WISHLIST_TABLE).insert({
        user_id: userId,
        item_type: itemType,
        item_id: itemId,
      });
      if (error) throw error;
      return true;
    },
    onMutate: async ({ itemType, itemId, isWishlisted }) => {
      if (!userId) return;
      await queryClient.cancelQueries({ queryKey: wishlistQueryKey(userId) });
      const previous = queryClient.getQueryData<WishlistRow[]>(wishlistQueryKey(userId));

      queryClient.setQueryData<WishlistRow[]>(wishlistQueryKey(userId), (old = []) => {
        if (isWishlisted) {
          return old.filter((r) => !(r.item_type === itemType && r.item_id === itemId));
        }
        return [
          {
            id: `optimistic-${itemId}`,
            user_id: userId,
            item_type: itemType,
            item_id: itemId,
            created_at: new Date().toISOString(),
          },
          ...old,
        ];
      });

      return { previous };
    },
    onError: (err, _vars, context) => {
      if (userId && context?.previous) {
        queryClient.setQueryData(wishlistQueryKey(userId), context.previous);
      }
      toast.error(err instanceof Error ? err.message : "Could not update wishlist");
    },
    onSettled: () => {
      if (userId) {
        void queryClient.invalidateQueries({ queryKey: wishlistQueryKey(userId) });
      }
    },
  });
}

export function useIsWishlisted(
  userId: string | null | undefined,
  itemType: WishlistItemType,
  itemId: string,
) {
  const { data: rows = [] } = useWishlist(userId);
  return rows.some((r) => r.item_type === itemType && r.item_id === itemId);
}
