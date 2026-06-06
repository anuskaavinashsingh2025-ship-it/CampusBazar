import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, GraduationCap, Loader2, ShoppingCart } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth";
import { useTrackListingView } from "@/lib/listing-views";
import {
  isChatUnlockedForNotesPurchase,
  useCreateNotesPurchase,
  useNotesPurchaseForListing,
} from "@/lib/notes-purchase-requests";
import { getStoragePublicUrl } from "@/lib/storage-url";
import { WishlistButton } from "@/components/wishlist/wishlist-button";
import { ChatSellerButton } from "@/components/listing/chat-seller-button";
import { ListingGallery } from "@/components/listing/listing-gallery";
import { ListingStats } from "@/components/listing/listing-stats";
import { RecentlyViewedSection } from "@/components/listing/recently-viewed-section";
import { ReportListingDialog } from "@/components/listing/report-listing-dialog";
import { SellerQuickView } from "@/components/listing/seller-quick-view";
import { ShareListingButton } from "@/components/listing/share-listing-button";
import { SimilarListings } from "@/components/listing/similar-listings";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  views_count?: number;
  wishlist_count?: number;
};

type NotesAssetRow = { kind: "image"; storage_path: string; sort_index: number };

const NOTES_LISTINGS_TABLE = "notes_listings" as unknown as keyof Database["public"]["Tables"];
const NOTES_ASSETS_TABLE = "notes_assets" as unknown as keyof Database["public"]["Tables"];

function NotesDetailsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { id } = Route.useParams();
  const createPurchase = useCreateNotesPurchase();
  const { data: existingRequest } = useNotesPurchaseForListing(id, user?.id);

  const [requestOpen, setRequestOpen] = useState(false);
  const [requestMessage, setRequestMessage] = useState("");
  const [rentalDurationDays, setRentalDurationDays] = useState("7");

  const { data: listing, isLoading } = useQuery({
    queryKey: ["notes_listing", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(NOTES_LISTINGS_TABLE)
        .select(
          "id,listing_type,title,description,category,subject,faculty,semester,branch,daily_rental_price,rental_duration_days,condition,is_digital,is_free,status,seller_id,created_at,views_count,wishlist_count",
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
        .eq("kind", "image")
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
        .select("user_id,slug,display_name,avatar_url,bio,rating_avg,rating_count")
        .eq("user_id", listing.seller_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: Boolean(listing?.seller_id),
  });

  const formatInr = (amount: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(amount);

  const previewImages = useMemo(
    () =>
      (assets ?? []).map((a) => ({
        url: getStoragePublicUrl("notes-assets", a.storage_path),
        sort_index: a.sort_index,
      })),
    [assets],
  );

  const priceLabel = useMemo(() => {
    if (!listing) return "";
    if (listing.is_free) return "Free";
    if (listing.listing_type === "rent" && listing.daily_rental_price != null) {
      return `${formatInr(Number(listing.daily_rental_price))} / day`;
    }
    return "See details";
  }, [listing]);

  useTrackListingView(
    "notes",
    listing?.id,
    listing
      ? {
          title: listing.title,
          coverUrl: previewImages[0]?.url ?? null,
          priceLabel,
          route: `/notes/${listing.id}`,
        }
      : null,
  );

  const chatUnlocked = isChatUnlockedForNotesPurchase(existingRequest?.status);

  const openRequest = () => {
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    if (listing && user.id === listing.seller_id) {
      toast.error("You can't buy your own notes.");
      return;
    }
    setRequestOpen(true);
  };

  const submitRequest = () => {
    if (!user || !listing) return;

    let message = requestMessage.trim();
    if (listing.listing_type === "rent") {
      const days = Number(rentalDurationDays);
      if (!days || days < 1) {
        toast.error("Enter a valid rental duration.");
        return;
      }
      const durationLine = `Rental Duration: ${days} day${days === 1 ? "" : "s"}`;
      message = message ? `${durationLine}\n${message}` : durationLine;
    }

    createPurchase.mutate(
      {
        notesListingId: listing.id,
        buyerId: user.id,
        sellerId: listing.seller_id,
        listingTitle: listing.title,
        message,
      },
      { onSuccess: () => setRequestOpen(false) },
    );
  };

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
            <Button variant="ghost" size="icon" aria-label="Back" onClick={() => navigate({ to: "/notes" })}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </div>
        </header>
        <main className="mx-auto max-w-4xl px-4 py-10 text-center text-sm text-muted-foreground">
          Notes listing not found.
        </main>
      </div>
    );
  }

  const buyLabel =
    listing.listing_type === "sell" ? "Buy Notes" : "Request Notes";

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-40 border-b bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" aria-label="Back" onClick={() => navigate({ to: "/notes" })}>
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
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <ListingGallery
            images={previewImages}
            alt={listing.title}
            overlay={<WishlistButton itemType="notes" itemId={listing.id} className="right-4 top-4" />}
          />

          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold">{listing.title}</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Posted {new Date(listing.created_at).toLocaleDateString()}
                </p>
                <p className="mt-1 text-lg font-bold text-primary">{priceLabel}</p>
                <div className="mt-2">
                  <ListingStats
                    viewsCount={listing.views_count ?? 0}
                    wishlistCount={listing.wishlist_count ?? 0}
                  />
                </div>
              </div>
              <Badge variant="secondary">{listing.listing_type === "sell" ? "Sell" : "Rent"}</Badge>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{listing.category}</Badge>
              {listing.subject && <Badge variant="outline">{listing.subject}</Badge>}
              {listing.faculty && <Badge variant="outline">{listing.faculty}</Badge>}
              {listing.semester && <Badge variant="outline">Sem {listing.semester}</Badge>}
              {listing.branch && <Badge variant="outline">{listing.branch}</Badge>}
              {listing.is_digital ? (
                <Badge variant="outline">Digital</Badge>
              ) : (
                <Badge variant="outline">Physical</Badge>
              )}
            </div>

            <div className="rounded-xl border bg-card p-4">
              <div className="text-sm font-semibold text-muted-foreground">Description</div>
              <p className="mt-2 whitespace-pre-wrap text-sm">{listing.description}</p>
            </div>

            {seller && <SellerQuickView seller={seller} />}

            <div className="flex flex-wrap gap-2">
              <ShareListingButton title={listing.title} />
              <ReportListingDialog itemType="notes" itemId={listing.id} />
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <ChatSellerButton
                sellerId={listing.seller_id}
                chatUnlocked={chatUnlocked}
                className="w-full gap-2"
              />
              <Button
                className="gap-2"
                onClick={openRequest}
                disabled={existingRequest?.status === "pending"}
              >
                <ShoppingCart className="h-4 w-4" />
                {existingRequest?.status === "pending" ? "Request Pending" : buyLabel}
              </Button>
            </div>
          </div>
        </div>

        <SimilarListings itemType="notes" currentId={listing.id} category={listing.category} />
        <RecentlyViewedSection excludeItemType="notes" excludeItemId={listing.id} />
      </main>

      <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{buyLabel}</DialogTitle>
            <DialogDescription>
              Send a request to {seller?.display_name ?? "the seller"} for these notes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {listing.listing_type === "rent" && (
              <div className="space-y-2">
                <Label htmlFor="notesDuration">Rental Duration (days)</Label>
                <Input
                  id="notesDuration"
                  type="number"
                  min={1}
                  value={rentalDurationDays}
                  onChange={(e) => setRentalDurationDays(e.target.value)}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="notesMsg">Message (optional)</Label>
              <Textarea
                id="notesMsg"
                value={requestMessage}
                onChange={(e) => setRequestMessage(e.target.value)}
                placeholder="When do you need these notes?"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRequestOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitRequest} disabled={createPurchase.isPending}>
              Send Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
