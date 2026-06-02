import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { type FormEvent, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/upload-food")({
  head: () => ({
    meta: [{ title: "Sell food — CampusBazar" }],
  }),
  component: UploadFoodPage,
});

const FOOD_CATEGORIES = [
  "Snacks",
  "Chocolates & Sweets",
  "Instant Food",
  "Beverages",
  "Health & Fitness",
  "Others",
] as const;

const FOOD_LISTINGS_TABLE = "food_listings" as unknown as keyof Database["public"]["Tables"];
const FOOD_IMAGES_TABLE = "food_images" as unknown as keyof Database["public"]["Tables"];
const SELLER_PROFILES_TABLE = "seller_profiles" as unknown as keyof Database["public"]["Tables"];

function UploadFoodPage() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const [productName, setProductName] = useState("");
  const [brandName, setBrandName] = useState("");
  const [category, setCategory] = useState<(typeof FOOD_CATEGORIES)[number]>("Snacks");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const sellerDisplayName = useMemo(() => {
    if (profile?.full_name?.trim()) return profile.full_name.trim();
    return user?.email ?? "seller";
  }, [profile?.full_name, user?.email]);

  const canSubmit =
    productName.trim() &&
    brandName.trim() &&
    category.trim() &&
    quantity.trim() &&
    Number(price) > 0 &&
    expiryDate &&
    description.trim() &&
    images.length >= 1;

  const validateFoodItem = () => {
    const banned = [
      "homemade",
      "tiffin",
      "alcohol",
      "tobacco",
      "medicine",
      "medicines",
      "cigarette",
    ];
    const text = `${productName} ${brandName} ${description}`.toLowerCase();
    return !banned.some((word) => text.includes(word));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) {
      toast.error("Please fill all required fields and upload at least 1 image.");
      return;
    }
    if (!validateFoodItem()) {
      toast.error("This listing includes prohibited food categories.");
      return;
    }
    if (new Date(expiryDate) < new Date(new Date().toISOString().slice(0, 10))) {
      toast.error("Expired products cannot be listed.");
      return;
    }

    setSubmitting(true);
    try {
      if (!user) throw new Error("Please login again.");

      const { data: existingSeller } = await supabase
        .from(SELLER_PROFILES_TABLE)
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!existingSeller) {
        const { error } = await supabase.from(SELLER_PROFILES_TABLE).insert({
          user_id: user.id,
          display_name: sellerDisplayName,
          avatar_url: profile?.avatar_url ?? null,
        } as never);
        if (error) throw error;
      }

      const { data: inserted, error: insertErr } = await supabase
        .from(FOOD_LISTINGS_TABLE)
        .insert({
          seller_id: user.id,
          product_name: productName.trim(),
          brand_name: brandName.trim(),
          category,
          quantity: quantity.trim(),
          price: Number(price),
          description: description.trim(),
          expiry_date: expiryDate,
          status: "available",
        } as never)
        .select("id")
        .maybeSingle();
      if (insertErr) throw insertErr;
      if (!inserted?.id) throw new Error("Failed to create food listing.");

      const listingId = inserted.id as string;
      for (let i = 0; i < images.length; i++) {
        const file = images[i];
        const objectName = `${listingId}/${i}-${file.name.replaceAll("/", "-")}`;
        const { error: uploadErr } = await supabase.storage
          .from("food-images")
          .upload(objectName, file, {
            contentType: file.type,
          });
        if (uploadErr) throw uploadErr;

        const { error: imgErr } = await supabase.from(FOOD_IMAGES_TABLE).insert({
          food_listing_id: listingId,
          storage_path: objectName,
          sort_index: i,
        } as never);
        if (imgErr) throw imgErr;
      }

      toast.success("Food listing posted!");
      navigate({ to: "/food/$id", params: { id: listingId } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not upload food listing");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl py-4">
      <Card>
        <CardHeader>
          <CardTitle>Sell Food Item</CardTitle>
          <CardDescription>Only packaged and branded food items are allowed.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Product Name</Label>
                <Input
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Brand Name</Label>
                <Input value={brandName} onChange={(e) => setBrandName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={category} onValueChange={(v) => setCategory(v as typeof category)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FOOD_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="120g / 1 pack"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Price</Label>
                <Input
                  type="number"
                  min={1}
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Expiry Date</Label>
                <Input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Product Images (1-5)</Label>
              <Input
                type="file"
                accept="image/*"
                multiple
                required
                onChange={(e) => setImages(Array.from(e.target.files ?? []).slice(0, 5))}
              />
            </div>

            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => navigate({ to: "/food" })}>
                Cancel
              </Button>
              <Button type="submit" disabled={!canSubmit || submitting}>
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Post Listing
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
