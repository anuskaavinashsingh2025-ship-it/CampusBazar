import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, GraduationCap, Loader2, MessageSquare, Flag, Heart } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth";
import { useIsWishlisted, useWishlistToggle } from "@/lib/wishlist";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/food/$id")({
  head: () => ({
    meta: [{ title: "Food listing — CampusBazar" }],
  }),
  component: FoodDetailsPage,
});

type FoodListingRow = {
  id: string;
  product_name: string;
  brand_name: string;
  category: string;
  quantity: string;
  price: number | string;
  description: string;
  expiry_date: string;
  status: "available" | "hidden" | "expired" | "sold";
  seller_id: string;
  created_at: string;
};

type FoodImageRow = { storage_path: string; sort_index: number };

const FOOD_LISTINGS_TABLE = "food_listings" as unknown as keyof Database["public"]["Tables"];
const FOOD_IMAGES_TABLE = "food_images" as unknown as keyof Database["public"]["Tables"];

function FoodDetailsPage() {
  const navigate = useNavigate();
  const { id } = Route.useParams();
  const { user } = useAuth();
  const isWishlisted = useIsWishlisted(user?.id, "food", id);
  const wishlistToggle = useWishlistToggle(user?.id);

  const { data: listing, isLoading } = useQuery({
    queryKey: ["food", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(FOOD_LISTINGS_TABLE)
        .select(
          "id,product_name,brand_name,category,quantity,price,description,expiry_date,status,seller_id,created_at",
        )
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as unknown as FoodListingRow | null;
    },
  });

  const { data: images } = useQuery({
    queryKey: ["food_images", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(FOOD_IMAGES_TABLE)
        .select("storage_path,sort_index")
        .eq("food_listing_id", id)
        .order("sort_index", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as FoodImageRow[];
    },
    enabled: Boolean(listing?.id),
  });

  const { data: seller } = useQuery({
    queryKey: ["food_seller", listing?.seller_id ?? null],
    queryFn: async () => {
      if (!listing?.seller_id) return null;
      const { data, error } = await supabase
        .from("seller_profiles")
        .select("slug,display_name,rating_avg,rating_count")
        .eq("user_id", listing.seller_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: Boolean(listing?.seller_id),
  });

  const formatInr = (amount: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(amount);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="min-h-screen bg-background">
        <main className="mx-auto max-w-4xl px-4 py-10 text-center text-sm text-muted-foreground">
          Food listing not found.
        </main>
      </div>
    );
  }

  const coverUrl = images?.[0]
    ? supabase.storage.from("food-images").getPublicUrl(images[0].storage_path).data.publicUrl
    : null;

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-40 border-b bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Back"
            onClick={() => navigate({ to: "/food" })}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Link to="/" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <GraduationCap className="h-5 w-5" />
            </span>
            <span className="text-sm font-bold tracking-tight">Food Hub</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-4">
        <Card className="overflow-hidden border-border/60">
          <CardContent className="space-y-4 p-4">
            {coverUrl ? (
              <img
                src={coverUrl}
                alt={listing.product_name}
                className="h-72 w-full rounded-xl object-cover"
              />
            ) : (
              <div className="flex h-72 items-center justify-center rounded-xl bg-muted text-sm text-muted-foreground">
                No image
              </div>
            )}

            <div className="space-y-1">
              <div className="text-2xl font-bold">{listing.product_name}</div>
              <div className="text-sm text-muted-foreground">{listing.brand_name}</div>
              <div className="text-xl font-bold">{formatInr(Number(listing.price))}</div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{listing.category}</Badge>
              <Badge variant="outline">{listing.quantity}</Badge>
              <Badge variant="outline">
                Expires on {new Date(listing.expiry_date).toLocaleDateString()}
              </Badge>
            </div>

            {seller && (
              <div className="rounded-lg border p-3 text-sm">
                <div className="font-semibold">
                  <Link
                    to="/seller/$slug"
                    params={{ slug: seller.slug }}
                    className="hover:underline"
                  >
                    {seller.display_name}
                  </Link>
                </div>
                <div className="text-xs text-muted-foreground">
                  Rating: {Number(seller.rating_avg ?? 0).toFixed(1)} ({seller.rating_count ?? 0})
                </div>
              </div>
            )}

            <div className="text-sm text-muted-foreground">{listing.description}</div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Button
                className="gap-2"
                onClick={() => toast.message("Chat integration coming soon")}
              >
                <MessageSquare className="h-4 w-4" />
                Chat with seller
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => {
                  if (!user) {
                    toast.error("Please login to save items");
                    navigate({ to: "/login" });
                    return;
                  }
                  wishlistToggle.mutate({ itemType: "food", itemId: id, isWishlisted });
                }}
              >
                <Heart className={`h-4 w-4 ${isWishlisted ? "fill-red-500 text-red-500" : ""}`} />
                {isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
              </Button>
            </div>

            <Button
              variant="ghost"
              className="w-full justify-center gap-2 text-muted-foreground"
              onClick={() => toast.message("Report listing from details page coming next")}
            >
              <Flag className="h-4 w-4" />
              Report listing
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
