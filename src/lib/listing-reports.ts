import { supabase } from "@/integrations/supabase/client";
import type { WishlistItemType } from "@/lib/wishlist";

export type ReportTargetType = "product" | "seller" | "rental" | "food" | "notes";

export async function uploadReportEvidence(userId: string, file: File) {
  const fileExt = file.name.split(".").pop();
  const fileName = `reports/${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
  const { data, error } = await supabase.storage.from("report-evidence").upload(fileName, file, {
    upsert: false,
  });
  if (error) throw error;
  const { data: urlData } = supabase.storage.from("report-evidence").getPublicUrl(data.path);
  return urlData.publicUrl;
}

export async function submitListingReport(input: {
  reporterId: string;
  targetType: ReportTargetType;
  itemId: string;
  sellerUserId?: string;
  category: string;
  details: string;
  evidenceUrls?: string[];
}) {
  // Validation
  if (!input.reporterId) {
    console.error("❌ RLS Error: reporter_id is missing or falsy");
    throw new Error("Reporter ID is required");
  }

  if (!input.targetType) {
    console.error("❌ Schema Error: target_type is missing");
    throw new Error("Target type is required");
  }

  if (!input.itemId && input.targetType !== "seller") {
    console.error("❌ Schema Error: itemId is missing for non-seller report");
    throw new Error("Item ID is required");
  }

  const payload: Record<string, unknown> = {
    reporter_id: input.reporterId,
    target_type: input.targetType,
    category: input.category,
    details: input.details || null,
    evidence_urls: input.evidenceUrls ?? [],
    evidence_count: (input.evidenceUrls ?? []).length,
    // Initialize all target ID columns as null
    product_id: null,
    seller_user_id: null,
    rental_id: null,
    food_listing_id: null,
    notes_listing_id: null,
  };

  // Set the appropriate target ID based on type
  switch (input.targetType) {
    case "product":
      payload.product_id = input.itemId;
      break;
    case "seller":
      payload.seller_user_id = input.sellerUserId ?? input.itemId;
      break;
    case "rental":
      payload.rental_id = input.itemId;
      break;
    case "food":
      payload.food_listing_id = input.itemId;
      break;
    case "notes":
      payload.notes_listing_id = input.itemId;
      break;
    default:
      console.error("❌ Invalid target_type:", input.targetType);
      throw new Error(`Invalid target type: ${input.targetType}`);
  }

  // Verify exactly one target ID is populated
  const targetIds = {
    product_id: payload.product_id,
    seller_user_id: payload.seller_user_id,
    rental_id: payload.rental_id,
    food_listing_id: payload.food_listing_id,
    notes_listing_id: payload.notes_listing_id,
  };

  const populatedIds = Object.entries(targetIds)
    .filter(([, value]) => value !== null)
    .map(([key]) => key);

  if (populatedIds.length !== 1) {
    console.error("❌ CHECK Constraint Error: Expected exactly one target ID, got:", populatedIds);
    throw new Error(`Expected exactly one target ID, got ${populatedIds.length}`);
  }

  // Log complete payload for debugging
  console.log("📋 Report Insert - Complete Payload:", {
    reporter_id: payload.reporter_id,
    target_type: payload.target_type,
    product_id: payload.product_id,
    seller_user_id: payload.seller_user_id,
    rental_id: payload.rental_id,
    food_listing_id: payload.food_listing_id,
    notes_listing_id: payload.notes_listing_id,
    category: payload.category,
    details: payload.details,
    evidence_urls: payload.evidence_urls,
    evidence_count: payload.evidence_count,
  });

  console.log("🔐 RLS Check:", {
    reporter_id: payload.reporter_id,
    auth_uid: "Will be compared by Supabase",
    expected_match: "reporter_id should equal auth.uid()",
  });

  console.log("✅ Constraint Verification:", {
    target_type_matches_id: `${input.targetType} ↔ ${populatedIds[0]}`,
    other_ids_are_null: Object.entries(targetIds)
      .filter(([key]) => key !== populatedIds[0])
      .map(([key, value]) => `${key}: ${value}`),
  });

  try {
    const { data, error } = await supabase.from("reports" as never).insert(payload as never);

    if (error) {
      console.error("❌ Insert Error:", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        payload_summary: {
          reporter_id: payload.reporter_id,
          target_type: payload.target_type,
          populated_id: populatedIds[0],
        },
      });
      throw error;
    }

    console.log("✅ Insert Successful:", { id: data?.[0]?.id, target_type: payload.target_type });
    return data;
  } catch (error) {
    console.error("💥 Fatal Insert Error:", error);
    throw error;
  }
}

export function reportTargetFromItemType(itemType: WishlistItemType): ReportTargetType {
  return itemType === "product" ? "product" : itemType;
}
