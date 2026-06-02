import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { GraduationCap, Loader2, ArrowLeft, Star, Tag } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/product/$id")({
  head: ({ params }) => ({
    meta: [{ title: `${params.id} — CampusBazar` }],
  }),
  component: ProductDetailsPage,
});

function ProductDetailsPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();

  type ProductListingRow = {
    id: string;
    title: string;
    description: string;
    category: string;
    custom_category: string | null;
    price: number | string;
    condition: string;
    urgent_sale: boolean;
    status: "available" | "sold" | "hidden";
    seller_id: string;
    created_at: string;
  };

  type SellerRow = {
    user_id: string;
    slug: string;
    display_name: string;
    avatar_url: string | null;
    bio: string | null;
    rating_avg: number;
    rating_count: number;
    total_sold: number;
  };

  type ProductImageRow = {
    storage_path: string;
    sort_index: number;
  };

  const PRODUCT_LISTINGS_TABLE =
    "product_listings" as unknown as keyof Database["public"]["Tables"];
  const PRODUCT_IMAGES_TABLE = "product_images" as unknown as keyof Database["public"]["Tables"];

  const { data: product, isLoading } = useQuery({
    queryKey: ["product", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(PRODUCT_LISTINGS_TABLE)
        .select(
          "id,title,description,category,custom_category,price,condition,urgent_sale,status,seller_id,created_at",
        )
        .eq("id", id)
        .eq("status", "available")
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as unknown as ProductListingRow | null;
    },
  });

  const { data: seller } = useQuery({
    queryKey: ["seller_for_product", product?.seller_id ?? null],
    queryFn: async () => {
      if (!product?.seller_id) return null;
      const { data, error } = await supabase
        .from("seller_profiles")
        .select("user_id,slug,display_name,avatar_url,bio,rating_avg,rating_count,total_sold")
        .eq("user_id", product.seller_id)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as SellerRow | null;
    },
    enabled: Boolean(product?.seller_id),
  });

  const { data: images } = useQuery({
    queryKey: ["product_images", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(PRODUCT_IMAGES_TABLE)
        .select("storage_path,sort_index")
        .eq("product_id", id)
        .order("sort_index", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as ProductImageRow[];
    },
    enabled: Boolean(product?.id),
  });

  const categoryLabel =
    product?.category === "Others" && product?.custom_category
      ? product.custom_category
      : product?.category;

  const formatInr = (amount: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(amount);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-linear-to-b from-secondary/60 to-background">
        <header className="border-b bg-card/80 backdrop-blur">
          <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
            <Link to="/" className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <GraduationCap className="h-5 w-5" />
              </span>
              <span className="font-bold tracking-tight">CampusBazar</span>
            </Link>
            <Button asChild variant="ghost" size="sm">
              <Link to="/marketplace">
                <ArrowLeft className="h-4 w-4" />
                Back to marketplace
              </Link>
            </Button>
          </div>
        </header>
        <main className="mx-auto max-w-4xl px-4 py-10">
          <div className="py-20 text-center">
            <h1 className="text-2xl font-bold">Listing not found</h1>
            <p className="mt-2 text-sm text-muted-foreground">This listing may be unavailable.</p>
          </div>
        </main>
      </div>
    );
  }

  const coverImages = (images ?? []) as unknown as ProductImageRow[];
  const reportProduct = async () => {
    if (!user) {
      toast.error("Please login to report.");
      return;
    }
    const reason = window.prompt("Reason (scam/spam/fake/offensive):", "scam");
    if (!reason) return;
    const details = window.prompt("Any additional details?", "");
    const { error } = await supabase.from("reports" as never).insert({
      reporter_id: user.id,
      target_type: "product",
      product_id: product.id,
      reason,
      details: details || null,
    } as never);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Report submitted.");
  };

  const coverImageModels = coverImages.map((img) => ({
    url: supabase.storage.from("product-images").getPublicUrl(img.storage_path).data.publicUrl,
    sort_index: img.sort_index,
  }));

  return (
    <div className="min-h-screen bg-linear-to-b from-secondary/60 to-background">
      <header className="border-b bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <GraduationCap className="h-5 w-5" />
            </span>
            <span className="font-bold tracking-tight">CampusBazar</span>
          </Link>
          <Button asChild variant="ghost" size="sm">
            <Link to="/marketplace">
              <ArrowLeft className="h-4 w-4" />
              Marketplace
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              {coverImageModels.length ? (
                <Carousel opts={{ loop: true }}>
                  <CarouselContent>
                    {coverImageModels.map((img) => (
                      <CarouselItem key={img.sort_index} className="basis-full">
                        <div className="w-full">
                          <img
                            src={img.url}
                            alt={product.title}
                            className="h-80 w-full object-cover"
                          />
                        </div>
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  <CarouselPrevious />
                  <CarouselNext />
                </Carousel>
              ) : (
                <div className="flex h-80 items-center justify-center bg-muted text-sm text-muted-foreground">
                  No images
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-4">
            <div>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h1 className="truncate text-2xl font-bold">{product.title}</h1>
                  <div className="mt-2 text-sm text-muted-foreground">
                    Posted {new Date(product.created_at).toLocaleDateString()}
                  </div>
                </div>
                {product.urgent_sale && <Badge variant="destructive">Urgent sale</Badge>}
              </div>

              <div className="mt-3 text-xl font-semibold">{formatInr(Number(product.price))}</div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">
                <Tag className="mr-1 h-3.5 w-3.5" />
                {categoryLabel}
              </Badge>
              <Badge variant="outline">{product.condition}</Badge>
            </div>

            <div className="rounded-xl border bg-card p-4">
              <h2 className="text-sm font-semibold text-muted-foreground">Description</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
                {product.description}
              </p>
            </div>

            {seller && (
              <div className="rounded-xl border bg-card p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      {seller.avatar_url ? (
                        <AvatarImage src={seller.avatar_url} alt={seller.display_name} />
                      ) : (
                        <AvatarFallback>
                          {seller.display_name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div>
                      <div className="text-sm font-semibold">
                        <Link
                          to="/seller/$slug"
                          params={{ slug: seller.slug }}
                          className="hover:underline"
                        >
                          {seller.display_name}
                        </Link>
                      </div>
                      <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                        {Number(seller.rating_avg ?? 0).toFixed(1)} ({seller.rating_count ?? 0}{" "}
                        reviews)
                      </div>
                    </div>
                  </div>
                </div>

                {seller.bio && <p className="mt-3 text-sm text-muted-foreground">{seller.bio}</p>}
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-3"
                  onClick={async () => {
                    if (!user) {
                      toast.error("Please login to report.");
                      return;
                    }
                    const reason = window.prompt(
                      "Reason (suspicious seller/spam/scam):",
                      "suspicious",
                    );
                    if (!reason) return;
                    const details = window.prompt("Any additional details?", "");
                    const { error } = await supabase.from("reports" as never).insert({
                      reporter_id: user.id,
                      target_type: "seller",
                      seller_user_id: seller.user_id,
                      reason,
                      details: details || null,
                    } as never);
                    if (error) {
                      toast.error(error.message);
                      return;
                    }
                    toast.success("Seller report submitted.");
                  }}
                >
                  Report seller
                </Button>
              </div>
            )}

            <Button variant="outline" onClick={reportProduct}>
              Report product
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
