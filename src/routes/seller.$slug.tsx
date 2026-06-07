import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  BadgeCheck,
  GraduationCap,
  Loader2,
  MessageSquare,
  Package,
  Share2,
  Star,
  Home,
  Zap,
  MoreVertical,
} from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { ProductCard, type ProductCardModel } from "@/components/marketplace/product-card";

export const Route = createFileRoute("/seller/$slug")({
  head: () => ({
    meta: [
      { title: "Seller — CampusBazar" },
      { name: "description", content: "View this seller's storefront on CampusBazar." },
    ],
  }),
  component: SellerPage,
});

function formatInr(amount: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(amount);
}

function SellerPage() {
  const { slug } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"products" | "rentals" | "reviews" | "completed">("products");

  const { data: seller, isLoading } = useQuery({
    queryKey: ["seller", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("seller_profiles")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: userProfile } = useQuery({
    queryKey: ["user_profile", seller?.user_id],
    queryFn: async () => {
      if (!seller) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", seller.user_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: Boolean(seller?.user_id),
  });

  const { data: products = [], isLoading: loadingProducts } = useQuery({
    queryKey: ["seller_products", seller?.user_id],
    queryFn: async () => {
      if (!seller) return [];
      const { data: listings, error } = await supabase
        .from("product_listings" as unknown as keyof Database["public"]["Tables"])
        .select("id,title,price,category,custom_category,condition,urgent_sale,status,seller_id,created_at")
        .eq("seller_id", seller.user_id)
        .eq("status", "available")
        .order("created_at", { ascending: false })
        .limit(24);
      if (error) throw error;
      const rows = listings ?? [];
      const ids = rows.map((r: { id: string }) => r.id);
      if (!ids.length) return [];

      const { data: images } = await supabase
        .from("product_images" as unknown as keyof Database["public"]["Tables"])
        .select("product_id,storage_path,sort_index")
        .in("product_id", ids);

      const imageMap = new Map<string, string>();
      for (const img of images ?? []) {
        const row = img as { product_id: string; storage_path: string; sort_index: number };
        if (!imageMap.has(row.product_id)) {
          imageMap.set(
            row.product_id,
            supabase.storage.from("product-images").getPublicUrl(row.storage_path).data.publicUrl,
          );
        }
      }

      return rows.map(
        (p: {
          id: string;
          title: string;
          price: number;
          category: string;
          custom_category: string | null;
          condition: string;
          urgent_sale: boolean;
          seller_id: string;
        }): ProductCardModel => ({
          id: p.id,
          title: p.title,
          price: Number(p.price),
          category: p.category,
          custom_category: p.custom_category,
          condition: p.condition,
          urgent_sale: p.urgent_sale,
          seller: {
            user_id: seller.user_id,
            slug: seller.slug,
            display_name: seller.display_name,
            avatar_url: seller.avatar_url,
            rating_avg: Number(seller.rating_avg),
          },
          coverImageUrl: imageMap.get(p.id) ?? null,
        }),
      );
    },
    enabled: Boolean(seller?.user_id),
  });

  const { data: rentals = [], isLoading: loadingRentals } = useQuery({
    queryKey: ["seller_rentals", seller?.user_id],
    queryFn: async () => {
      if (!seller) return [];
      const { data, error } = await supabase
        .from("rental_listings" as unknown as keyof Database["public"]["Tables"])
        .select("id,title,rent_price_per_day,category,custom_category,status,created_at")
        .eq("seller_id", seller.user_id)
        .eq("status", "available")
        .order("created_at", { ascending: false })
        .limit(24);
      if (error) throw error;
      return data ?? [];
    },
    enabled: Boolean(seller?.user_id),
  });

  const { data: soldProducts = [] } = useQuery({
    queryKey: ["seller_sold", seller?.user_id],
    queryFn: async () => {
      if (!seller) return [];
      const { data } = await supabase
        .from("product_listings" as unknown as keyof Database["public"]["Tables"])
        .select("id,title,price,category,status,updated_at")
        .eq("seller_id", seller.user_id)
        .eq("status", "sold")
        .order("updated_at", { ascending: false })
        .limit(12);
      return data ?? [];
    },
    enabled: Boolean(seller?.user_id),
  });

  const { data: completedRentals = [] } = useQuery({
    queryKey: ["seller_completed_rentals", seller?.user_id],
    queryFn: async () => {
      if (!seller) return [];
      const { data } = await supabase
        .from("rental_listings" as unknown as keyof Database["public"]["Tables"])
        .select("id,title,rent_price_per_day,category,updated_at")
        .eq("seller_id", seller.user_id)
        .eq("status", "rented_out")
        .order("updated_at", { ascending: false })
        .limit(12);
      return data ?? [];
    },
    enabled: Boolean(seller?.user_id),
  });

  const { data: completedNotes = [] } = useQuery({
    queryKey: ["seller_completed_notes", seller?.user_id],
    queryFn: async () => {
      if (!seller) return [];
      const { data } = await supabase
        .from("notes_listings" as unknown as keyof Database["public"]["Tables"])
        .select("id,title,price,category,updated_at")
        .eq("seller_id", seller.user_id)
        .eq("status", "sold")
        .order("updated_at", { ascending: false })
        .limit(12);
      return data ?? [];
    },
    enabled: Boolean(seller?.user_id),
  });

  const { data: completedFood = [] } = useQuery({
    queryKey: ["seller_completed_food", seller?.user_id],
    queryFn: async () => {
      if (!seller) return [];
      const { data } = await supabase
        .from("food_listings" as unknown as keyof Database["public"]["Tables"])
        .select("id,title,price,category,updated_at")
        .eq("seller_id", seller.user_id)
        .eq("status", "sold")
        .order("updated_at", { ascending: false })
        .limit(12);
      return data ?? [];
    },
    enabled: Boolean(seller?.user_id),
  });

  const { data: sellerMetrics } = useQuery({
    queryKey: ["seller_metrics", seller?.user_id],
    queryFn: async () => {
      if (!seller) return null;
      
      const [productSales, notesSales, foodSales, rentalCompletions, reviews] = await Promise.all([
        supabase
          .from("product_listings" as unknown as keyof Database["public"]["Tables"])
          .select("id")
          .eq("seller_id", seller.user_id)
          .eq("status", "sold"),
        supabase
          .from("notes_listings" as unknown as keyof Database["public"]["Tables"])
          .select("id")
          .eq("seller_id", seller.user_id)
          .eq("status", "sold"),
        supabase
          .from("food_listings" as unknown as keyof Database["public"]["Tables"])
          .select("id")
          .eq("seller_id", seller.user_id)
          .eq("status", "sold"),
        supabase
          .from("rental_listings" as unknown as keyof Database["public"]["Tables"])
          .select("id")
          .eq("seller_id", seller.user_id)
          .eq("status", "rented_out"),
        supabase
          .from("reviews" as unknown as keyof Database["public"]["Tables"])
          .select("id,rating")
          .eq("seller_user_id", seller.user_id),
      ]);

      const totalSales = (productSales.data?.length ?? 0) + (notesSales.data?.length ?? 0) + (foodSales.data?.length ?? 0);
      const rentalsCompleted = rentalCompletions.data?.length ?? 0;
      const reviewsReceived = reviews.data?.length ?? 0;
      const averageRating = reviewsReceived > 0 
        ? (reviews.data?.reduce((sum, r) => sum + (r as { rating: number }).rating, 0) ?? 0) / reviewsReceived
        : 0;

      return {
        totalSales,
        rentalsCompleted,
        reviewsReceived,
        averageRating,
      };
    },
    enabled: Boolean(seller?.user_id),
  });

  const { data: existingConversation } = useQuery({
    queryKey: ["conversation_with_seller", user?.id, seller?.user_id],
    queryFn: async () => {
      if (!user || !seller) return null;
      const { data } = await supabase
        .from("conversations" as unknown as keyof Database["public"]["Tables"])
        .select("id")
        .eq("buyer_id", user.id)
        .eq("seller_id", seller.user_id)
        .maybeSingle();
      return data as { id: string } | null;
    },
    enabled: Boolean(user?.id && seller?.user_id),
  });

  const { data: hasAcceptedTransaction } = useQuery({
    queryKey: ["accepted_transaction_with_seller", user?.id, seller?.user_id],
    queryFn: async () => {
      if (!user || !seller) return false;
      
      const [productRequests, rentalRequests, notesPurchases, foodOrders] = await Promise.all([
        supabase
          .from("product_requests" as unknown as keyof Database["public"]["Tables"])
          .select("id")
          .eq("buyer_id", user.id)
          .eq("seller_id", seller.user_id)
          .eq("status", "accepted")
          .limit(1),
        supabase
          .from("rental_requests" as unknown as keyof Database["public"]["Tables"])
          .select("id")
          .eq("buyer_id", user.id)
          .eq("seller_id", seller.user_id)
          .eq("status", "accepted")
          .limit(1),
        supabase
          .from("notes_purchases" as unknown as keyof Database["public"]["Tables"])
          .select("id")
          .eq("buyer_id", user.id)
          .eq("seller_id", seller.user_id)
          .eq("status", "accepted")
          .limit(1),
        supabase
          .from("food_orders" as unknown as keyof Database["public"]["Tables"])
          .select("id")
          .eq("buyer_id", user.id)
          .eq("seller_id", seller.user_id)
          .eq("status", "accepted")
          .limit(1),
      ]);

      return (
        (productRequests.data?.length ?? 0) > 0 ||
        (rentalRequests.data?.length ?? 0) > 0 ||
        (notesPurchases.data?.length ?? 0) > 0 ||
        (foodOrders.data?.length ?? 0) > 0
      );
    },
    enabled: Boolean(user?.id && seller?.user_id),
  });

  const memberSince = seller?.joined_at
    ? new Date(seller.joined_at).toLocaleDateString("en-IN", { month: "short", year: "numeric" })
    : "—";

  const handleMessageSeller = () => {
    if (!user) {
      toast.error("Please login to message seller.");
      return;
    }

    if (existingConversation) {
      navigate({ to: "/chats/$id", params: { id: existingConversation.id } });
      return;
    }

    toast.error("Chat unlocks after the seller accepts your request.");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-secondary/40 to-background">
      <header className="border-b bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <GraduationCap className="h-5 w-5" />
            </span>
            <span className="font-bold tracking-tight">CampusBazar</span>
          </Link>
          <Button asChild variant="ghost" size="sm">
            <Link to="/">
              <ArrowLeft className="h-4 w-4" />
              Home
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !seller ? (
          <div className="py-20 text-center">
            <h1 className="text-2xl font-bold">Seller not found</h1>
            <Button asChild className="mt-6">
              <Link to="/">Back home</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            <Card className="overflow-hidden border-0 shadow-md">
              <div className="h-28 bg-gradient-to-r from-primary via-orange-500 to-amber-400 sm:h-36" />
              <CardContent className="relative px-4 pb-6 sm:px-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                    <div className="relative -mt-12">
                      <Avatar className="h-24 w-24 border-4 border-card shadow-lg sm:h-28 sm:w-28">
                        {seller.avatar_url && (
                          <AvatarImage src={seller.avatar_url} alt={seller.display_name} />
                        )}
                        <AvatarFallback className="bg-primary text-xl text-primary-foreground">
                          {seller.display_name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="absolute bottom-2 right-2 h-3 w-3 rounded-full border-2 border-card bg-emerald-500" />
                    </div>
                    <div className="pb-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h1 className="text-2xl font-bold">{seller.display_name}</h1>
                        <BadgeCheck className="h-5 w-5 text-sky-600" />
                      </div>
                      {seller.bio && (
                        <p className="mt-1 max-w-xl text-sm text-muted-foreground">{seller.bio}</p>
                      )}
                      {userProfile?.hostel_block && (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {userProfile.hostel_type} - {userProfile.hostel_block}
                        </p>
                      )}
                      {userProfile?.room_number && (
                        <p className="text-sm text-muted-foreground">Room {userProfile.room_number}</p>
                      )}
                      {userProfile?.phone_number && (
                        <p className="text-sm text-muted-foreground">{userProfile.phone_number}</p>
                      )}
                      {userProfile?.email && (
                        <p className="text-sm text-muted-foreground">{userProfile.email}</p>
                      )}
                      <div className="mt-3 flex flex-wrap gap-4 text-sm">
                        <span className="flex items-center gap-1">
                          <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                          <strong>{(sellerMetrics?.averageRating ?? Number(seller.rating_avg)).toFixed(1)}</strong>
                        </span>
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Package className="h-4 w-4" />
                          {sellerMetrics?.totalSales ?? seller.total_sold} sold
                        </span>
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Home className="h-4 w-4" />
                          {sellerMetrics?.rentalsCompleted ?? seller.total_rented_out} rentals
                        </span>
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Zap className="h-4 w-4" />
                          Fast responder
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Member since {memberSince}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={handleMessageSeller}>
                      <MessageSquare className="mr-2 h-4 w-4" />
                      Message Seller
                    </Button>
                    {user?.id === seller.user_id && (
                      <Button variant="outline" asChild>
                        <Link to="/seller-profile">
                          Edit Profile
                        </Link>
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      onClick={() => {
                        void navigator.clipboard.writeText(window.location.href);
                        toast.success("Profile link copied");
                      }}
                    >
                      <Share2 className="mr-2 h-4 w-4" />
                      Share Profile
                    </Button>
                    <Button variant="ghost" size="icon" aria-label="More options">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Seller performance</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    ["Total sales", sellerMetrics?.totalSales ?? seller.total_sold],
                    ["Active listings", products.length],
                    ["Rentals completed", sellerMetrics?.rentalsCompleted ?? seller.total_rented_out],
                    ["Reviews received", sellerMetrics?.reviewsReceived ?? seller.rating_count],
                    ["Average rating", `${(sellerMetrics?.averageRating ?? Number(seller.rating_avg)).toFixed(1)} / 5`],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="rounded-lg bg-muted/40 p-3">
                      <div className="text-xs text-muted-foreground">{label}</div>
                      <div className="font-semibold">{value}</div>
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Seller badges</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3">
                  {[
                    { title: "Top Seller", sub: "High Performer", color: "bg-amber-100 text-amber-800" },
                    { title: "Trusted Seller", sub: "Verified & Reliable", color: "bg-sky-100 text-sky-800" },
                    { title: "Fast Responder", sub: "Quick Replies", color: "bg-emerald-100 text-emerald-800" },
                    {
                      title: seller.total_sold >= 50 ? "50+ Sales" : "Rising Seller",
                      sub: "CampusBazar member",
                      color: "bg-violet-100 text-violet-800",
                    },
                  ].map((b) => (
                    <div key={b.title} className={`rounded-xl p-3 ${b.color}`}>
                      <div className="text-sm font-semibold">{b.title}</div>
                      <div className="text-xs opacity-80">{b.sub}</div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
              <TabsList>
                <TabsTrigger value="products">Products ({products.length})</TabsTrigger>
                <TabsTrigger value="rentals">Rentals ({rentals.length})</TabsTrigger>
                <TabsTrigger value="reviews">Reviews ({sellerMetrics?.reviewsReceived ?? seller.rating_count})</TabsTrigger>
                <TabsTrigger value="completed">Completed ({soldProducts.length + completedRentals.length + completedNotes.length + completedFood.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="products" className="mt-4">
                {loadingProducts ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : products.length ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {products.map((p) => (
                      <ProductCard key={p.id} product={p} />
                    ))}
                  </div>
                ) : (
                  <Card className="border-dashed">
                    <CardContent className="py-12 text-center text-sm text-muted-foreground">
                      No active products listed yet.
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="rentals" className="mt-4">
                {loadingRentals ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : rentals.length ? (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {(rentals as { id: string; title: string; rent_price_per_day: number; category: string }[]).map(
                      (r) => (
                        <Link key={r.id} to="/rent/$id" params={{ id: r.id }}>
                          <Card className="transition-shadow hover:shadow-md">
                            <CardContent className="p-4">
                              <h3 className="font-semibold">{r.title}</h3>
                              <p className="text-sm text-muted-foreground">{r.category}</p>
                              <p className="mt-2 font-bold text-primary">
                                {formatInr(Number(r.rent_price_per_day))}/day
                              </p>
                            </CardContent>
                          </Card>
                        </Link>
                      ),
                    )}
                  </div>
                ) : (
                  <Card className="border-dashed">
                    <CardContent className="py-12 text-center text-sm text-muted-foreground">
                      No active rentals listed yet.
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="reviews" className="mt-4">
                <Card>
                  <CardContent className="py-8">
                    <div className="flex flex-col items-center gap-2 text-center">
                      <div className="text-4xl font-bold">{(sellerMetrics?.averageRating ?? Number(seller.rating_avg)).toFixed(1)}</div>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <Star
                            key={i}
                            className={`h-5 w-5 ${
                              i <= Math.round(sellerMetrics?.averageRating ?? Number(seller.rating_avg))
                                ? "fill-amber-400 text-amber-400"
                                : "text-muted-foreground"
                            }`}
                          />
                        ))}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {sellerMetrics?.reviewsReceived ?? seller.rating_count} reviews
                      </p>
                      {(sellerMetrics?.reviewsReceived ?? seller.rating_count) === 0 && (
                        <p className="mt-4 text-sm text-muted-foreground">
                          No written reviews yet. Be the first to buy from this seller!
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="completed" className="mt-4">
                <div className="space-y-6">
                  {soldProducts.length > 0 && (
                    <div>
                      <h3 className="mb-3 text-sm font-semibold">Completed Products</h3>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {(soldProducts as { id: string; title: string; price: number; category: string; updated_at: string }[]).map((p) => (
                          <Card key={p.id} className="opacity-75">
                            <CardContent className="p-4">
                              <h4 className="font-semibold">{p.title}</h4>
                              <p className="text-sm text-muted-foreground">{p.category}</p>
                              <p className="mt-2 font-bold text-primary">{formatInr(Number(p.price))}</p>
                              <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                                <Badge variant="outline">Completed</Badge>
                                <span>{new Date(p.updated_at).toLocaleDateString()}</span>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}
                  {completedRentals.length > 0 && (
                    <div>
                      <h3 className="mb-3 text-sm font-semibold">Completed Rentals</h3>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {(completedRentals as { id: string; title: string; rent_price_per_day: number; category: string; updated_at: string }[]).map((r) => (
                          <Card key={r.id} className="opacity-75">
                            <CardContent className="p-4">
                              <h4 className="font-semibold">{r.title}</h4>
                              <p className="text-sm text-muted-foreground">{r.category}</p>
                              <p className="mt-2 font-bold text-primary">{formatInr(Number(r.rent_price_per_day))}/day</p>
                              <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                                <Badge variant="outline">Completed</Badge>
                                <span>{new Date(r.updated_at).toLocaleDateString()}</span>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}
                  {completedNotes.length > 0 && (
                    <div>
                      <h3 className="mb-3 text-sm font-semibold">Completed Notes</h3>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {(completedNotes as { id: string; title: string; price: number; category: string; updated_at: string }[]).map((n) => (
                          <Card key={n.id} className="opacity-75">
                            <CardContent className="p-4">
                              <h4 className="font-semibold">{n.title}</h4>
                              <p className="text-sm text-muted-foreground">{n.category}</p>
                              <p className="mt-2 font-bold text-primary">{formatInr(Number(n.price))}</p>
                              <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                                <Badge variant="outline">Completed</Badge>
                                <span>{new Date(n.updated_at).toLocaleDateString()}</span>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}
                  {completedFood.length > 0 && (
                    <div>
                      <h3 className="mb-3 text-sm font-semibold">Completed Food</h3>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {(completedFood as { id: string; title: string; price: number; category: string; updated_at: string }[]).map((f) => (
                          <Card key={f.id} className="opacity-75">
                            <CardContent className="p-4">
                              <h4 className="font-semibold">{f.title}</h4>
                              <p className="text-sm text-muted-foreground">{f.category}</p>
                              <p className="mt-2 font-bold text-primary">{formatInr(Number(f.price))}</p>
                              <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                                <Badge variant="outline">Completed</Badge>
                                <span>{new Date(f.updated_at).toLocaleDateString()}</span>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}
                  {soldProducts.length === 0 && completedRentals.length === 0 && completedNotes.length === 0 && completedFood.length === 0 && (
                    <Card className="border-dashed">
                      <CardContent className="py-12 text-center text-sm text-muted-foreground">
                        No completed items yet.
                      </CardContent>
                    </Card>
                  )}
                </div>
              </TabsContent>
            </Tabs>

            {soldProducts.length > 0 && tab === "products" && (
              <p className="text-right text-sm text-primary">
                {soldProducts.length}+ items sold on CampusBazar
              </p>
            )}

            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap gap-4 text-sm">
                  <span className="flex items-center gap-1 text-emerald-700">
                    <BadgeCheck className="h-4 w-4" />
                    Student verified
                  </span>
                  <span className="flex items-center gap-1 text-emerald-700">
                    <BadgeCheck className="h-4 w-4" />
                    Campus member
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    if (!user) {
                      toast.error("Please login to report seller.");
                      return;
                    }
                    const reason = window.prompt("Reason:", "suspicious");
                    if (!reason) return;
                    const { error } = await supabase.from("reports" as never).insert({
                      reporter_id: user.id,
                      target_type: "seller",
                      seller_user_id: seller.user_id,
                      reason,
                      details: null,
                    } as never);
                    if (error) toast.error(error.message);
                    else toast.success("Seller reported.");
                  }}
                >
                  Report seller
                </Button>
              </CardContent>
            </Card>

            <p className="text-center text-xs text-muted-foreground">
              CampusBazar connects students on campus. Always meet in safe public places and verify
              items before paying.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
