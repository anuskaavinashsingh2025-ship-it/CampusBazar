import { supabase } from "@/integrations/supabase/client";
import type { WishlistItemType } from "@/lib/wishlist";

export type ReportTargetType = "product" | "seller" | "rental" | "food" | "notes";

const MAX_EVIDENCE_IMAGES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_FILE_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp"];

export async function uploadReportEvidence(reportId: string, files: File[]): Promise<string[]> {
  console.log("[REPORT EVIDENCE UPLOAD] Starting upload for report:", reportId);
  console.log("[REPORT EVIDENCE UPLOAD] Number of files:", files.length);

  if (files.length > MAX_EVIDENCE_IMAGES) {
    throw new Error(`Maximum ${MAX_EVIDENCE_IMAGES} images allowed`);
  }

  const uploadedUrls: string[] = [];

  for (const file of files) {
    console.log("[REPORT EVIDENCE UPLOAD] Processing file:", file.name, file.size, file.type);

    // Validate file type
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      throw new Error(`Invalid file type: ${file.type}. Allowed: PNG, JPG, JPEG, WEBP`);
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`File too large: ${file.name}. Maximum size is 10MB`);
    }

    const fileExt = file.name.split(".").pop();
    const fileName = `${reportId}/${Date.now()}.${fileExt}`;
    console.log("[REPORT EVIDENCE UPLOAD] Storage path:", fileName);

    const { data, error } = await supabase.storage
      .from("report-evidence")
      .upload(fileName, file, {
        upsert: false,
      });

    if (error) {
      console.error("[REPORT EVIDENCE UPLOAD] Upload error:", error);
      throw error;
    }

    console.log("[REPORT EVIDENCE UPLOAD] Upload successful:", data);

    const {
      data: { publicUrl },
    } = supabase.storage.from("report-evidence").getPublicUrl(data.path);

    uploadedUrls.push(publicUrl);
    console.log("[REPORT EVIDENCE UPLOAD] Public URL:", publicUrl);
  }

  console.log("[REPORT EVIDENCE UPLOAD] All uploads completed");
  return uploadedUrls;
}

export async function submitListingReport(input: {
  reporterId: string;
  targetType: ReportTargetType;
  itemId: string;
  sellerUserId?: string;
  reason: string;
  details?: string;
  evidenceFiles?: File[];
}) {
  console.log("[SUBMIT LISTING REPORT] Starting report submission");

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
  else if (input.targetType === "seller")
    payload.seller_user_id = input.sellerUserId ?? input.itemId;

  // Handle evidence uploads
  let evidenceUrls: string[] = [];
  if (input.evidenceFiles && input.evidenceFiles.length > 0) {
    console.log("[SUBMIT LISTING REPORT] Uploading evidence files");
    // First create the report to get the ID
    const { data: reportData, error: insertError } = await supabase
      .from("reports" as never)
      .insert(payload as never)
      .select("id")
      .single();

    if (insertError) {
      console.error("[SUBMIT LISTING REPORT] Insert error:", insertError);
      throw insertError;
    }

    const reportId = (reportData as { id: string }).id;
    console.log("[SUBMIT LISTING REPORT] Report created with ID:", reportId);

    // Upload evidence files
    evidenceUrls = await uploadReportEvidence(reportId, input.evidenceFiles);

    // Update report with evidence URLs (may fail if columns don't exist yet)
    try {
      const { error: updateError } = await supabase
        .from("reports" as never)
        .update({
          evidence_urls: evidenceUrls,
          evidence_count: evidenceUrls.length,
        } as never)
        .eq("id", reportId);

      if (updateError) {
        console.warn("[SUBMIT LISTING REPORT] Evidence update failed (columns may not exist yet):", updateError);
        // Don't fail the entire submission if evidence columns don't exist
      }
    } catch (e) {
      console.warn("[SUBMIT LISTING REPORT] Evidence update threw error (columns may not exist yet):", e);
      // Don't fail the entire submission if evidence columns don't exist
    }

    console.log("[SUBMIT LISTING REPORT] Report submission completed with evidence");
    return;
  }

  // No evidence, just insert the report
  const { error } = await supabase.from("reports" as never).insert(payload as never);
  if (error) {
    console.error("[SUBMIT LISTING REPORT] Insert error:", error);
    throw error;
  }

  console.log("[SUBMIT LISTING REPORT] Report submission completed without evidence");
}

export function reportTargetFromItemType(itemType: WishlistItemType): ReportTargetType {
  return itemType === "product" ? "product" : itemType;
}
