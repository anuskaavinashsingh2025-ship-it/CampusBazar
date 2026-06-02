import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, GraduationCap, Loader2, Plus, Search } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/food")({
  head: () => ({
    meta: [{ title: "Food Hub — CampusBazar" }],
  }),
  component: FoodHubPage,
});

type FoodListingRow = {
  id: string;
  product_name: string;
  brand_name: string;
  category: string;
  quantity: string;
  price: number | string;
  expiry_date: string;
  status: "available" | "hidden" | "expired" | "sold";
  seller_id: string;
  created_at: string;
};

type FoodImageRow = { food_listing_id: string; storage_path: string; sort_index: number };

type FoodRequestRow = {
  id: string;
  product_name: string;
  category: string;
  quantity_needed: string;
  description: string;
  urgency_level: string;
  status: string;
  created_at: string;
};

const FOOD_LISTINGS_TABLE = "food_listings" as unknown as keyof Database["public"]["Tables"];
const FOOD_IMAGES_TABLE = "food_images" as unknown as keyof Database["public"]["Tables"];
const FOOD_REQUESTS_TABLE = "food_requests" as unknown as keyof Database["public"]["Tables"];

function FoodHubPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tab, setTab] = useState<"sell" | "requests">("sell");
  const [query, setQuery] = useState("");

  const { data: listings, isLoading: loadingListings } = useQuery({
    queryKey: ["food", "listings"],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from(FOOD_LISTINGS_TABLE)
        .select(
          "id,product_name,brand_name,category,quantity,price,expiry_date,status,seller_id,created_at",
        )
        .eq("status", "available")
        .gte("expiry_date", today)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      const rows = (data ?? []) as unknown as FoodListingRow[];

      const ids = rows.map((r) => r.id);
      const { data: images } = await supabase
        .from(FOOD_IMAGES_TABLE)
        .select("food_listing_id,storage_path,sort_index")
        .in("food_listing_id", ids);
      const imageRows = (images ?? []) as unknown as FoodImageRow[];
      const imageMap = new Map<string, FoodImageRow[]>();
      for (const img of imageRows) {
        const arr = imageMap.get(img.food_listing_id) ?? [];
        arr.push(img);
        imageMap.set(img.food_listing_id, arr);
      }

      return rows.map((r) => {
        const cover = (imageMap.get(r.id) ?? []).sort((a, b) => a.sort_index - b.sort_index)[0];
        const coverUrl = cover
          ? supabase.storage.from("food-images").getPublicUrl(cover.storage_path).data.publicUrl
          : null;
        return { ...r, coverUrl };
      });
    },
    refetchInterval: 10000,
  });

  const { data: requests, isLoading: loadingRequests } = useQuery({
    queryKey: ["food", "requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(FOOD_REQUESTS_TABLE)
        .select(
          "id,product_name,category,quantity_needed,description,urgency_level,status,created_at",
        )
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as FoodRequestRow[];
    },
    refetchInterval: 10000,
  });

  const filteredListings = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return listings ?? [];
    return (listings ?? []).filter((l) => {
      return (
        l.product_name.toLowerCase().includes(q) ||
        l.brand_name.toLowerCase().includes(q) ||
        l.category.toLowerCase().includes(q)
      );
    });
  }, [listings, query]);

  const filteredRequests = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return requests ?? [];
    return (requests ?? []).filter((r) => {
      return (
        r.product_name.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q)
      );
    });
  }, [requests, query]);

  const formatInr = (amount: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(amount);

  const getExpiryBadge = (expiryDate: string) => {
    const today = new Date();
    const expiry = new Date(expiryDate);
    const diff = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diff > 60)
      return { label: `${diff} days left`, className: "bg-emerald-100 text-emerald-700" };
    if (diff >= 30)
      return { label: `${diff} days left`, className: "bg-yellow-100 text-yellow-700" };
    return { label: `${Math.max(diff, 0)} days left`, className: "bg-red-100 text-red-700" };
  };

  const openForm = (mode: "sell" | "request") => {
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    if (mode === "sell") navigate({ to: "/upload-food" });
    else navigate({ to: "/upload-food-request" });
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-40 border-b bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Back"
            onClick={() => navigate({ to: "/" })}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Link to="/" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <GraduationCap className="h-5 w-5" />
            </span>
            <div className="leading-tight">
              <div className="text-sm font-bold tracking-tight">Food Hub</div>
              <div className="text-[10px] text-muted-foreground">Only packaged & branded food</div>
            </div>
          </Link>

          <div className="relative ml-auto flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="h-10 rounded-full bg-background pl-9"
              placeholder="Search food or brand..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <Button
            size="icon"
            className="rounded-full"
            onClick={() => openForm(tab === "sell" ? "sell" : "request")}
          >
            <Plus className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-4">
        <div className="mb-3 grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={() => openForm("sell")}>
            Sell details
          </Button>
          <Button variant="outline" onClick={() => openForm("request")}>
            Request details
          </Button>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="sell">Sell</TabsTrigger>
            <TabsTrigger value="requests">Requests</TabsTrigger>
          </TabsList>

          <TabsContent value="sell" className="mt-4">
            {loadingListings ? (
              <div className="flex justify-center py-16 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : filteredListings.length ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filteredListings.map((l) => {
                  const expiry = getExpiryBadge(l.expiry_date);
                  return (
                    <Card
                      key={l.id}
                      className="border-border/60 shadow-sm"
                      onClick={() => navigate({ to: "/food/$id", params: { id: l.id } })}
                    >
                      <CardContent className="p-0">
                        {l.coverUrl ? (
                          <img
                            src={l.coverUrl}
                            alt={l.product_name}
                            className="h-40 w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-40 w-full items-center justify-center bg-muted text-sm text-muted-foreground">
                            No image
                          </div>
                        )}
                        <div className="space-y-2 p-3">
                          <div className="text-sm font-semibold">{l.product_name}</div>
                          <div className="text-xs text-muted-foreground">{l.brand_name}</div>
                          <div className="text-sm font-bold">{formatInr(Number(l.price))}</div>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="outline">{l.category}</Badge>
                            <Badge variant="outline">{l.quantity}</Badge>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${expiry.className}`}
                            >
                              {expiry.label}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="py-16 text-center text-sm text-muted-foreground">
                No food listings yet.
              </div>
            )}
          </TabsContent>

          <TabsContent value="requests" className="mt-4">
            {loadingRequests ? (
              <div className="flex justify-center py-16 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : filteredRequests.length ? (
              <div className="space-y-3">
                {filteredRequests.map((r) => (
                  <Card key={r.id} className="border-border/60 shadow-sm">
                    <CardContent className="space-y-2 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold">{r.product_name}</div>
                          <div className="text-xs text-muted-foreground">{r.category}</div>
                        </div>
                        <Badge variant="secondary">{r.urgency_level}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">{r.description}</div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => toast.message("I Have This is coming soon")}
                        >
                          I Have This
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => toast.message("Chat is coming soon")}
                        >
                          Chat User
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => toast.message("Mark fulfilled is coming soon")}
                        >
                          Mark Fulfilled
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="py-16 text-center text-sm text-muted-foreground">
                No food requests yet.
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
