import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { GraduationCap, Search, Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/rent")({
  head: () => ({
    meta: [{ title: "Rent — CampusBazar" }],
  }),
  component: RentFeedPage,
});

type RentalRow = {
  id: string;
  title: string;
  rent_price_per_day: number | string;
  category: string;
  custom_category: string | null;
  condition: string;
  status: "available" | "rented_out" | "unavailable";
  seller_id: string;
  created_at: string;
};

type RentalImageRow = {
  rental_id: string;
  storage_path: string;
  sort_index: number;
};

const RENTAL_LISTINGS_TABLE = "rental_listings" as unknown as keyof Database["public"]["Tables"];
const RENTAL_IMAGES_TABLE = "rental_images" as unknown as keyof Database["public"]["Tables"];

function RentFeedPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["rentals", "feed"],
    queryFn: async () => {
      const { data: rentals, error } = await supabase
        .from(RENTAL_LISTINGS_TABLE)
        .select(
          "id,title,rent_price_per_day,category,custom_category,condition,status,seller_id,created_at",
        )
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;

      const rows = (rentals ?? []) as unknown as RentalRow[];
      const ids = rows.map((r) => r.id);
      const { data: images } = await supabase
        .from(RENTAL_IMAGES_TABLE)
        .select("rental_id,storage_path,sort_index")
        .in("rental_id", ids);
      const imageRows = (images ?? []) as unknown as RentalImageRow[];

      const map = new Map<string, RentalImageRow[]>();
      for (const img of imageRows) {
        const arr = map.get(img.rental_id) ?? [];
        arr.push(img);
        map.set(img.rental_id, arr);
      }

      return rows.map((r) => {
        const cover = (map.get(r.id) ?? []).sort((a, b) => a.sort_index - b.sort_index)[0];
        const coverUrl = cover
          ? supabase.storage.from("rental-images").getPublicUrl(cover.storage_path).data.publicUrl
          : null;
        return { ...r, coverUrl };
      });
    },
    refetchInterval: 5000,
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data ?? [];
    return (data ?? []).filter((r) => {
      const category =
        r.category === "Others" && r.custom_category ? r.custom_category : r.category;
      return (
        r.title.toLowerCase().includes(q) ||
        category.toLowerCase().includes(q) ||
        r.condition.toLowerCase().includes(q)
      );
    });
  }, [data, query]);

  const formatInr = (amount: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(amount);

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
              <div className="text-sm font-bold tracking-tight">Rent</div>
              <div className="text-[10px] text-muted-foreground">CampusBazar</div>
            </div>
          </Link>

          <div className="relative ml-auto flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="h-10 rounded-full bg-background pl-9"
              placeholder="Search rentals..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-4">
        <div className="mb-3 text-sm font-semibold">Rent listings</div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {isLoading ? (
            <div className="col-span-full flex justify-center py-16 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : filtered.length ? (
            filtered.map((r) => (
              <Card
                key={r.id}
                className="overflow-hidden border-border/60 shadow-sm"
                onClick={() => navigate({ to: "/rent/$id", params: { id: r.id } })}
              >
                <CardContent className="p-0">
                  {r.coverUrl ? (
                    <img src={r.coverUrl} alt={r.title} className="h-40 w-full object-cover" />
                  ) : (
                    <div className="flex h-40 w-full items-center justify-center bg-muted text-sm text-muted-foreground">
                      No image
                    </div>
                  )}
                  <div className="space-y-2 p-3">
                    <div className="text-sm font-semibold text-foreground">
                      {formatInr(Number(r.rent_price_per_day))} / day
                    </div>
                    <div className="line-clamp-2 text-sm font-medium">{r.title}</div>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span className="rounded-md bg-muted px-2 py-1">
                        {r.category === "Others" && r.custom_category
                          ? r.custom_category
                          : r.category}
                      </span>
                      <span className="rounded-md bg-muted px-2 py-1">{r.condition}</span>
                      <Badge variant="secondary" className="ml-auto">
                        {r.status === "available"
                          ? "Available"
                          : r.status === "rented_out"
                            ? "Rented out"
                            : "Unavailable"}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="col-span-full py-16 text-center text-sm text-muted-foreground">
              No rentals found.
            </div>
          )}
        </div>

        <div className="mt-6 text-xs text-muted-foreground">
          Chat and reports are not built in this phase. Those actions will be added later.
        </div>
      </main>
    </div>
  );
}
