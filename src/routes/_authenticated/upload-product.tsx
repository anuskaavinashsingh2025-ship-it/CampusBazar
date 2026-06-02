import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { GraduationCap, Image as ImageIcon, Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { Database } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CATEGORY_OPTIONS = [
  "Books",
  "Electronics",
  "Lab Equipment",
  "Hostel Essentials",
  "Cycles",
  "Fashion",
  "Furniture",
  "Sports",
  "Stationery",
  "Food",
  "Others",
] as const;

const CONDITION_OPTIONS = ["New", "Like New", "Good", "Fair", "Used"] as const;

type CategoryOption = (typeof CATEGORY_OPTIONS)[number];
type ConditionOption = (typeof CONDITION_OPTIONS)[number];

type SellerInsertable = {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
};

type ProductImagesInsertable = {
  product_id: string;
  storage_path: string;
  sort_index: number;
};

const SELLER_PROFILES_TABLE = "seller_profiles" as unknown as keyof Database["public"]["Tables"];
const PRODUCT_LISTINGS_TABLE = "product_listings" as unknown as keyof Database["public"]["Tables"];
const PRODUCT_IMAGES_TABLE = "product_images" as unknown as keyof Database["public"]["Tables"];

export const Route = createFileRoute("/_authenticated/upload-product")({
  head: () => ({
    meta: [{ title: "Upload product — CampusBazar" }],
  }),
  component: UploadProductPage,
});

function UploadProductPage() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const sellerDisplayName = useMemo(() => {
    if (profile?.full_name?.trim()) return profile.full_name.trim();
    return user?.email ?? "seller";
  }, [profile?.full_name, user?.email]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<CategoryOption>("Books");
  const [customCategory, setCustomCategory] = useState("");
  const [price, setPrice] = useState<string>("");
  const [condition, setCondition] = useState<ConditionOption>("Good");
  const [urgentSale, setUrgentSale] = useState(false);
  const [images, setImages] = useState<File[]>([]);

  const [submitting, setSubmitting] = useState(false);

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const canSubmit =
    title.trim().length > 0 &&
    description.trim().length > 0 &&
    (category !== "Others" || customCategory.trim().length > 0) &&
    price.trim().length > 0 &&
    Number(price) > 0 &&
    images.length >= 1 &&
    images.length <= 5;

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    const next = Array.from(fileList).slice(0, 5);
    setImages(next);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) {
      toast.error("Please fill all required fields (and upload 1–5 images).");
      return;
    }

    setSubmitting(true);
    try {
      // Ensure seller profile exists (connect products to seller_profiles)
      const { data: existingSeller } = await supabase
        .from(SELLER_PROFILES_TABLE)
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!existingSeller) {
        const sellerInsert: SellerInsertable = {
          user_id: user.id,
          display_name: sellerDisplayName,
          avatar_url: profile?.avatar_url ?? null,
        };

        const { error: sellerInsertErr } = await supabase
          .from(SELLER_PROFILES_TABLE)
          .insert(sellerInsert);
        if (sellerInsertErr) throw sellerInsertErr;
      }

      const priceNumber = Number(price);

      const { data: inserted, error: productInsertErr } = await supabase
        .from(PRODUCT_LISTINGS_TABLE)
        .insert({
          seller_id: user.id,
          title: title.trim(),
          description: description.trim(),
          category,
          custom_category: category === "Others" ? customCategory.trim() : null,
          price: priceNumber,
          condition,
          urgent_sale: urgentSale,
          status: "available",
        })
        .select("id")
        .maybeSingle();

      if (productInsertErr) throw productInsertErr;
      if (!inserted?.id) throw new Error("Failed to create product listing.");

      const productId = inserted.id as string;

      // Upload images to Supabase Storage
      // Object name is: <product_id>/<sort_index>-<original_filename>
      const bucket = "product-images";

      for (let i = 0; i < images.length; i++) {
        const file = images[i];
        const objectName = `${productId}/${i}-${file.name.replaceAll("/", "-")}`;

        const { error: uploadErr } = await supabase.storage.from(bucket).upload(objectName, file, {
          upsert: false,
          contentType: file.type,
        });
        if (uploadErr) throw uploadErr;

        const { error: imageInsertErr } = await supabase.from(PRODUCT_IMAGES_TABLE).insert({
          product_id: productId,
          storage_path: objectName,
          sort_index: i,
        } satisfies ProductImagesInsertable);

        if (imageInsertErr) throw imageInsertErr;
      }

      toast.success("Product uploaded!");
      navigate({ to: "/product/$id", params: { id: productId } });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not upload product";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-b from-secondary/60 via-background to-background">
      <header className="border-b bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <GraduationCap className="h-5 w-5" />
            </span>
            <span className="font-bold tracking-tight">CampusBazar</span>
          </Link>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">Profile verified</Badge>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="text-2xl">Upload your product</CardTitle>
            <CardDescription>
              Add up to 5 images. Your listing will appear in the marketplace feed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. FAT Survival Kit - Operating Systems"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Write details that help buyers trust the listing."
                  required
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={category} onValueChange={(v) => setCategory(v as CategoryOption)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORY_OPTIONS.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Condition</Label>
                  <Select
                    value={condition}
                    onValueChange={(v) => setCondition(v as ConditionOption)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select condition" />
                    </SelectTrigger>
                    <SelectContent>
                      {CONDITION_OPTIONS.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="price">Price (INR)</Label>
                  <Input
                    id="price"
                    type="number"
                    min={1}
                    step="0.01"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="500"
                    required
                  />
                </div>

                {category === "Others" ? (
                  <div className="space-y-2">
                    <Label htmlFor="customCategory">Custom category</Label>
                    <Input
                      id="customCategory"
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      placeholder="e.g. Calculators"
                      required
                    />
                  </div>
                ) : (
                  <div className="hidden sm:block" />
                )}
              </div>

              <div className="flex items-center gap-3">
                <Checkbox
                  id="urgentSale"
                  checked={urgentSale}
                  onCheckedChange={(v) => setUrgentSale(Boolean(v))}
                />
                <Label htmlFor="urgentSale" className="cursor-pointer">
                  Mark as urgent sale (shows a badge)
                </Label>
              </div>

              <div className="space-y-2">
                <Label>Product images (1–5)</Label>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 rounded-lg border border-dashed bg-card p-3">
                      <ImageIcon className="h-5 w-5 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium">Upload images</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          Max 5 images. Recommended: 3–5.
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        onClick={() => document.getElementById("productImagesInput")?.click()}
                      >
                        Choose
                      </Button>
                    </div>
                    <input
                      id="productImagesInput"
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => handleFiles(e.target.files)}
                    />
                  </div>
                </div>

                {images.length > 0 && (
                  <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
                    {images.map((f, idx) => (
                      <div
                        key={`${f.name}-${idx}`}
                        className="relative overflow-hidden rounded-lg border bg-background"
                      >
                        <img
                          src={URL.createObjectURL(f)}
                          alt={`Upload preview ${idx + 1}`}
                          className="h-24 w-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                )}

                <div className="text-xs text-muted-foreground">Selected: {images.length}/5</div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Button
                  type="button"
                  variant="outline"
                  disabled={submitting}
                  onClick={() => navigate({ to: "/" })}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={!canSubmit || submitting}>
                  {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Upload listing
                </Button>
              </div>

              <div className="rounded-xl border bg-card p-3 text-xs text-muted-foreground">
                Listing status is set to{" "}
                <span className="font-medium text-foreground">Available</span>. Sold/Hidden flows
                come in later phases.
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
