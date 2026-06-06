import { supabase } from "@/integrations/supabase/client";
import type { WishlistItemType } from "@/lib/wishlist";

export type ReportTargetType = "product" | "seller" | "rental" | "food" | "notes";

export async function submitListingReport(input: {
  reporterId: string;
  targetType: ReportTargetType;
  itemId: string;
  sellerUserId?: string;
  reason: string;
  details?: string;
}) {
  const payload: Record<string, unknown> = {
    reporter_id: input.reporterId,
    target_type: input.targetType,
    reason: input.reason,
    details: input.details || null,
  };

  if (input.targetType === "product") payload.product_id = input.itemId;
  else if (input.targetType === "rental") payload.rental_id = input.itemId;
  else if (input.targetType === "food") payload.food_listing_id = input.itemId;
  else if (input.targetType === "notes") payload.notes_listing_id = input.itemId;
  else if (input.targetType === "seller") payload.seller_user_id = input.sellerUserId ?? input.itemId;

  const { error } = await supabase.from("reports" as never).insert(payload as never);
  if (error) throw error;
}

export function reportTargetFromItemType(itemType: WishlistItemType): ReportTargetType {
  return itemType === "product" ? "product" : itemType;
}
