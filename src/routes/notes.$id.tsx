import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, GraduationCap, Loader2, Flag, MessageSquare } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/notes/$id")({
  head: () => ({
    meta: [{ title: "Notes listing — CampusBazar" }],
  }),
  component: NotesDetailsPage,
});

type NotesListingRow = {
  id: string;
  listing_type: "sell" | "rent";
  title: string;
  description: string;
  category: string;
  subject: string | null;
  faculty: string | null;
  semester: string | null;
  branch: string | null;
  daily_rental_price: number | string | null;
  rental_duration_days: number | null;
  condition: string | null;
  is_digital: boolean;
  is_free: boolean;
  status: string;
  seller_id: string;
  created_at: string;
};

type NotesAssetRow = { kind: "image"; storage_path: string; sort_index: number };

const NOTES_LISTINGS_TABLE = "notes_listings" as unknown as keyof Database["public"]["Tables"];
const NOTES_ASSETS_TABLE = "notes_assets" as unknown as keyof Database["public"]["Tables"];

function NotesDetailsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { id } = Route.useParams();

  const { data: listing, isLoading } = useQuery({
    queryKey: ["notes_listing", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(NOTES_LISTINGS_TABLE)
        .select(
          "id,listing_type,title,description,category,subject,faculty,semester,branch,daily_rental_price,rental_duration_days,condition,is_digital,is_free,status,seller_id,created_at",
        )
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as unknown as NotesListingRow | null;
    },
  });

  const { data: assets } = useQuery({
    queryKey: ["notes_assets", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(NOTES_ASSETS_TABLE)
        .select("kind,storage_path,sort_index")
        .eq("listing_id", id)
        .order("sort_index", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as NotesAssetRow[];
    },
    enabled: Boolean(listing?.id),
  });

  const { data: seller } = useQuery({
    queryKey: ["notes_seller", listing?.seller_id ?? null],
    queryFn: async () => {
      if (!listing?.seller_id) return null;
      const { data, error } = await supabase
        .from("seller_profiles")
        .select("user_id,slug,display_name,avatar_url,rating_avg,rating_count")
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
        <header className="border-b bg-card/90 backdrop-blur">
          <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Back"
              onClick={() => navigate({ to: "/notes" })}
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
          Notes listing not found.
        </main>
      </div>
    );
  }

  const previewImages = (assets ?? []).map((a) => ({
    url: supabase.storage.from("notes-assets").getPublicUrl(a.storage_path).data.publicUrl,
    sort_index: a.sort_index,
  }));

  const primaryAction = () => {
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    toast.message("Transactions/Chat are coming soon");
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-40 border-b bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Back"
            onClick={() => navigate({ to: "/notes" })}
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
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xl font-bold">{listing.title}</div>
              <div className="mt-1 text-xs text-muted-foreground">{listing.category}</div>
            </div>
            <Badge variant="secondary">{listing.listing_type === "sell" ? "Sell" : "Rent"}</Badge>
          </div>

          <div className="flex flex-wrap gap-2">
            {listing.subject && <Badge variant="outline">{listing.subject}</Badge>}
            {listing.faculty && <Badge variant="outline">{listing.faculty}</Badge>}
            {listing.semester && <Badge variant="outline">Sem {listing.semester}</Badge>}
            {listing.branch && <Badge variant="outline">{listing.branch}</Badge>}
            {listing.is_digital ? (
              <Badge variant="outline">Digital</Badge>
            ) : (
              <Badge variant="outline">Physical</Badge>
            )}
            {listing.is_free ? (
              <Badge variant="outline">Free</Badge>
            ) : (
              <Badge variant="outline">Paid</Badge>
            )}
            {listing.listing_type === "rent" && listing.daily_rental_price != null && (
              <Badge variant="outline">{formatInr(Number(listing.daily_rental_price))} / day</Badge>
            )}
          </div>

          <Card className="border-border/60">
            <CardContent className="space-y-2 p-4">
              <div className="text-sm font-semibold text-muted-foreground">Description</div>
              <div className="whitespace-pre-wrap text-sm">{listing.description}</div>
            </CardContent>
          </Card>

          {previewImages.length > 0 && (
            <Card className="border-border/60">
              <CardContent className="p-4">
                <div className="mb-3 text-sm font-semibold text-muted-foreground">
                  Preview images
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {previewImages.map((img) => (
                    <img
                      key={img.sort_index}
                      src={img.url}
                      alt={listing.title}
                      className="h-28 w-full rounded-lg object-cover"
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {seller && (
            <Card className="border-border/60">
              <CardContent className="space-y-1 p-4">
                <div className="text-sm font-semibold">Seller</div>
                <Link
                  to="/seller/$slug"
                  params={{ slug: seller.slug }}
                  className="text-sm hover:underline"
                >
                  {seller.display_name}
                </Link>
                <div className="text-xs text-muted-foreground">
                  Rating: {Number(seller.rating_avg ?? 0).toFixed(1)} ({seller.rating_count ?? 0})
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-1">
            <Button className="gap-2" onClick={primaryAction}>
              <MessageSquare className="h-4 w-4" />
              {listing.listing_type === "sell" ? "Buy / Contact" : "Request / Contact"}
            </Button>
          </div>

          <Button
            variant="ghost"
            className="w-full justify-center gap-2 text-muted-foreground"
            onClick={() => toast.message("Report is coming soon")}
          >
            <Flag className="h-4 w-4" />
            Report
          </Button>
        </div>
      </main>
    </div>
  );
}
