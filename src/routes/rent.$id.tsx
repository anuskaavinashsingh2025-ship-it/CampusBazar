import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, GraduationCap, Loader2, MessageSquare, Flag } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

export const Route = createFileRoute("/rent/$id")({
  head: () => ({
    meta: [{ title: "Rent item — CampusBazar" }],
  }),
  component: RentDetailsPage,
});

type RentalRow = {
  id: string;
  title: string;
  description: string;
  rent_price_per_day: number | string;
  category: string;
  custom_category: string | null;
  condition: string;
  status: "available" | "rented_out" | "unavailable";
  seller_id: string;
  created_at: string;
};

type RentalImageRow = { storage_path: string; sort_index: number };

const RENTAL_LISTINGS_TABLE = "rental_listings" as unknown as keyof Database["public"]["Tables"];
const RENTAL_IMAGES_TABLE = "rental_images" as unknown as keyof Database["public"]["Tables"];

function RentDetailsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { id } = Route.useParams();

  const { data: rental, isLoading } = useQuery({
    queryKey: ["rental", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(RENTAL_LISTINGS_TABLE)
        .select(
          "id,title,description,rent_price_per_day,category,custom_category,condition,status,seller_id,created_at",
        )
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as unknown as RentalRow | null;
    },
  });

  const { data: images } = useQuery({
    queryKey: ["rental_images", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(RENTAL_IMAGES_TABLE)
        .select("storage_path,sort_index")
        .eq("rental_id", id)
        .order("sort_index", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as RentalImageRow[];
    },
    enabled: Boolean(rental?.id),
  });

  const { data: seller } = useQuery({
    queryKey: ["rental_seller", rental?.seller_id ?? null],
    queryFn: async () => {
      if (!rental?.seller_id) return null;
      const { data, error } = await supabase
        .from("seller_profiles")
        .select("user_id,slug,display_name,avatar_url,rating_avg,rating_count")
        .eq("user_id", rental.seller_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: Boolean(rental?.seller_id),
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

  if (!rental) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card/90 backdrop-blur">
          <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Back"
              onClick={() => navigate({ to: "/rent" })}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Link to="/" className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <GraduationCap className="h-5 w-5" />
              </span>
              <span className="text-sm font-bold tracking-tight">CampusBazar</span>
            </Link>
          </div>
        </header>
        <main className="mx-auto max-w-4xl px-4 py-10 text-center text-sm text-muted-foreground">
          Rental listing not found.
        </main>
      </div>
    );
  }

  const imageModels = (images ?? []).map((img) => ({
    url: supabase.storage.from("rental-images").getPublicUrl(img.storage_path).data.publicUrl,
    sort_index: img.sort_index,
  }));

  const statusLabel =
    rental.status === "available"
      ? "Available"
      : rental.status === "rented_out"
        ? "Rented out"
        : "Unavailable";

  const categoryLabel =
    rental.category === "Others" && rental.custom_category
      ? rental.custom_category
      : rental.category;

  const requestRental = async () => {
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    if (rental.seller_id === user.id) {
      toast.error("You can't request your own rental.");
      return;
    }
    if (rental.status !== "available") {
      toast.error("This item is not available for request.");
      return;
    }

    const { error } = await supabase.from("rental_requests" as never).insert({
      rental_id: rental.id,
      buyer_id: user.id,
      seller_id: rental.seller_id,
      status: "pending",
    } as never);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Rental request sent!");
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-40 border-b bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Back"
            onClick={() => navigate({ to: "/rent" })}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Link to="/" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <GraduationCap className="h-5 w-5" />
            </span>
            <span className="text-sm font-bold tracking-tight">CampusBazar</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              {imageModels.length ? (
                <Carousel opts={{ loop: true }}>
                  <CarouselContent>
                    {imageModels.map((img) => (
                      <CarouselItem key={img.sort_index}>
                        <img
                          src={img.url}
                          alt={rental.title}
                          className="h-80 w-full object-cover"
                        />
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

          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xl font-bold">{rental.title}</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {formatInr(Number(rental.rent_price_per_day))} / day
                </div>
              </div>
              <Badge variant="secondary">{statusLabel}</Badge>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{categoryLabel}</Badge>
              <Badge variant="outline">{rental.condition}</Badge>
            </div>

            <div className="rounded-xl border bg-card p-4">
              <div className="text-sm font-semibold text-muted-foreground">Description</div>
              <div className="mt-2 whitespace-pre-wrap text-sm">{rental.description}</div>
            </div>

            {seller && (
              <div className="rounded-xl border bg-card p-4">
                <div className="text-sm font-semibold">Seller</div>
                <div className="mt-1 text-sm">
                  <Link
                    to="/seller/$slug"
                    params={{ slug: seller.slug }}
                    className="hover:underline"
                  >
                    {seller.display_name}
                  </Link>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Rating: {Number(seller.rating_avg ?? 0).toFixed(1)} ({seller.rating_count ?? 0})
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Button
                variant="outline"
                onClick={() => toast.message("Chat is coming soon")}
                className="gap-2"
              >
                <MessageSquare className="h-4 w-4" />
                Chat
              </Button>
              <Button onClick={requestRental}>Request Rental</Button>
            </div>

            <Button
              variant="ghost"
              onClick={() => toast.message("Report is coming soon")}
              className="w-full justify-center gap-2 text-muted-foreground"
            >
              <Flag className="h-4 w-4" />
              Report
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
