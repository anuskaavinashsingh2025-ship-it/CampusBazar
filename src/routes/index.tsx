import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  GraduationCap,
  Heart,
  MessageSquare,
  User,
  Menu,
  Search,
  Plus,
  Home,
  Grid2X2,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { Database } from "@/integrations/supabase/types";

import { ProductCard, type ProductCardModel } from "@/components/marketplace/product-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CampusBazar — The VIT Student Marketplace" },
      {
        name: "description",
        content:
          "Buy, sell, rent and share notes with fellow VIT students. CampusBazar is the trusted campus marketplace.",
      },
      { property: "og:title", content: "CampusBazar — The VIT Student Marketplace" },
      {
        property: "og:description",
        content: "Buy, sell, rent and share notes with fellow VIT students.",
      },
    ],
  }),
  component: MarketplaceHome,
});

type ProductListingRow = {
  id: string;
  title: string;
  price: number | string;
  category: string;
  custom_category: string | null;
  condition: string;
  urgent_sale: boolean;
  seller_id: string;
  created_at: string;
};

type ProductImageRow = {
  product_id: string;
  storage_path: string;
  sort_index: number;
};

const PRODUCT_LISTINGS_TABLE = "product_listings" as unknown as keyof Database["public"]["Tables"];
const PRODUCT_IMAGES_TABLE = "product_images" as unknown as keyof Database["public"]["Tables"];

const CATEGORY_STRIP = [
  { key: "Food", label: "Food" },
  { key: "Rent", label: "Rent" },
  { key: "Notes", label: "Notes" },
  { key: "Books", label: "Books" },
  { key: "Electronics", label: "Electronics" },
  { key: "Furniture", label: "Furniture" },
  { key: "Clothes", label: "Clothes" },
  { key: "More", label: "More" },
] as const;

function MarketplaceHome() {
  const navigate = useNavigate();
  const { user, profile, isAdmin, signOut } = useAuth();
  const [query, setQuery] = useState("");
  const [profilePickerOpen, setProfilePickerOpen] = useState(false);

  const { data: sellerProfile } = useQuery({
    queryKey: ["seller_profile_self", user?.id ?? null],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("seller_profiles")
        .select("user_id,slug,display_name")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: Boolean(user?.id),
  });

  const { data: products, isLoading } = useQuery({
    queryKey: ["marketplace_home", "recommendations"],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from(PRODUCT_LISTINGS_TABLE)
        .select(
          "id,title,price,category,custom_category,condition,urgent_sale,seller_id,created_at",
        )
        .eq("status", "available")
        .order("created_at", { ascending: false })
        .limit(30);

      if (error) throw error;
      const productRows = (rows ?? []) as unknown as ProductListingRow[];
      if (!productRows.length) return [] as ProductCardModel[];

      const sellerIds = [...new Set(productRows.map((p) => p.seller_id))];
      const { data: sellers } = await supabase
        .from("seller_profiles")
        .select("user_id,slug,display_name,avatar_url")
        .in("user_id", sellerIds);

      const sellerMap = new Map(
        (sellers ?? []).map((s) => [
          s.user_id,
          {
            user_id: s.user_id,
            slug: s.slug,
            display_name: s.display_name,
            avatar_url: s.avatar_url,
          },
        ]),
      );

      const productIds = productRows.map((p) => p.id);
      const { data: images } = await supabase
        .from(PRODUCT_IMAGES_TABLE)
        .select("product_id,storage_path,sort_index")
        .in("product_id", productIds);

      const imageRows = (images ?? []) as unknown as ProductImageRow[];
      const imageMap = new Map<string, { storage_path: string; sort_index: number }[]>();
      for (const img of imageRows) {
        const key = img.product_id;
        const arr = imageMap.get(key) ?? [];
        arr.push({ storage_path: img.storage_path, sort_index: img.sort_index });
        imageMap.set(key, arr);
      }

      return productRows.map((p) => {
        const sorted = (imageMap.get(p.id) ?? []).sort((a, b) => a.sort_index - b.sort_index);
        const cover = sorted[0]?.storage_path ?? null;
        const coverImageUrl = cover
          ? supabase.storage.from("product-images").getPublicUrl(cover).data.publicUrl
          : null;

        return {
          id: p.id,
          title: p.title,
          price: Number(p.price),
          category: p.category,
          custom_category: p.custom_category,
          condition: p.condition,
          urgent_sale: p.urgent_sale,
          seller: sellerMap.get(p.seller_id) ?? {
            user_id: p.seller_id,
            slug: "unknown",
            display_name: "Unknown seller",
            avatar_url: null,
          },
          coverImageUrl,
        } satisfies ProductCardModel;
      });
    },
    refetchInterval: 5000,
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products ?? [];
    return (products ?? []).filter((p) => {
      const category =
        p.category === "Others" && p.custom_category ? p.custom_category : p.category;
      return (
        p.title.toLowerCase().includes(q) ||
        category.toLowerCase().includes(q) ||
        p.condition.toLowerCase().includes(q) ||
        p.seller.display_name.toLowerCase().includes(q)
      );
    });
  }, [products, query]);

  const handleSell = () => {
    navigate({ to: "/upload-product" });
  };

  const handleDisabled = (label: string) => {
    toast.message(`${label} is coming soon`, {
      description: "This is not part of the current phase.",
    });
  };

  const handleProfileTap = () => {
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    setProfilePickerOpen(true);
  };

  const openUserProfile = () => {
    setProfilePickerOpen(false);
    navigate({ to: "/profile" });
  };

  const openSellerProfile = () => {
    setProfilePickerOpen(false);
    navigate({ to: "/seller-profile" });
  };

  const handleLogout = async () => {
    await signOut();
    toast.success("Signed out");
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-40 border-b bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0">
              <div className="p-6">
                <SheetHeader className="text-left">
                  <SheetTitle>CampusBazar</SheetTitle>
                </SheetHeader>
                <div className="mt-2 text-sm text-muted-foreground">
                  {user ? (profile?.full_name ?? user.email) : "Guest"}
                </div>
              </div>
              <Separator />
              <div className="space-y-1 p-2">
                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => navigate({ to: "/" })}
                >
                  Home
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => navigate({ to: "/dashboard" })}
                  disabled={!user}
                >
                  Dashboard
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() =>
                    sellerProfile?.slug
                      ? navigate({ to: "/seller/$slug", params: { slug: sellerProfile.slug } })
                      : handleSell()
                  }
                  disabled={!user}
                >
                  Seller profile
                </Button>
                <Separator className="my-2" />
                {isAdmin && (
                  <Button
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={() => navigate({ to: "/admin" })}
                  >
                    Admin portal
                  </Button>
                )}
                {user ? (
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-destructive"
                    onClick={handleLogout}
                  >
                    Log out
                  </Button>
                ) : (
                  <Button className="w-full" onClick={() => navigate({ to: "/login" })}>
                    Sign in
                  </Button>
                )}
              </div>
            </SheetContent>
          </Sheet>

          <Link to="/" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <GraduationCap className="h-5 w-5" />
            </span>
            <div className="leading-tight">
              <div className="text-sm font-bold tracking-tight">CampusBazar</div>
              <div className="text-[10px] text-muted-foreground">for VIT students</div>
            </div>
          </Link>

          <div className="relative ml-auto flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="h-10 rounded-full bg-background pl-9"
              placeholder="Search for items, notes, food, rent..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="hidden items-center gap-1 sm:flex">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Wishlist"
              onClick={() => {
                if (!user) navigate({ to: "/login" });
                else navigate({ to: "/wishlist" });
              }}
            >
              <Heart className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Chats"
              onClick={() => handleDisabled("Chats")}
            >
              <MessageSquare className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" aria-label="Profile" onClick={handleProfileTap}>
              <User className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-10 pt-4">
        <Card className="overflow-hidden border-border/60">
          <CardContent className="grid gap-4 p-4 sm:grid-cols-2 sm:items-center">
            <div className="space-y-2">
              <div className="text-2xl font-bold leading-tight">
                Smart Choices. <span className="text-primary">Student Voices.</span>
              </div>
              <div className="text-sm text-muted-foreground">
                Buy, sell, exchange or discover everything a student needs — all in one trusted
                place.
              </div>
              <div className="pt-2">
                <Button
                  onClick={() =>
                    document.getElementById("fresh-recos")?.scrollIntoView({ behavior: "smooth" })
                  }
                >
                  Explore Now
                </Button>
              </div>
            </div>
            <div className="hidden justify-end sm:flex">
              <div className="h-40 w-full rounded-xl bg-linear-to-br from-primary/15 via-accent/10 to-secondary/40" />
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm font-semibold">Browse Categories</div>
          <Button variant="ghost" size="sm" onClick={() => handleDisabled("View all categories")}>
            View all
          </Button>
        </div>

        <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
          {CATEGORY_STRIP.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => {
                if (c.key === "Rent") {
                  navigate({ to: "/rent" });
                  return;
                }
                if (c.key === "Notes") {
                  navigate({ to: "/notes" });
                  return;
                }
                if (c.key === "Food") {
                  navigate({ to: "/food" });
                  return;
                }
                handleDisabled(c.label);
              }}
              className="min-w-[80px] rounded-xl border bg-card px-3 py-3 text-center text-xs shadow-sm"
            >
              <div className="mx-auto mb-2 h-9 w-9 rounded-xl bg-muted" />
              <div className="font-medium">{c.label}</div>
            </button>
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between" id="fresh-recos">
          <div className="text-sm font-semibold">Fresh recommendations</div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDisabled("View all recommendations")}
          >
            View all
          </Button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {isLoading ? (
            <div className="col-span-full py-16 text-center text-sm text-muted-foreground">
              Loading…
            </div>
          ) : filtered.length ? (
            filtered.map((p) => <ProductCard key={p.id} product={p} />)
          ) : (
            <div className="col-span-full py-16 text-center text-sm text-muted-foreground">
              No listings found.
            </div>
          )}
        </div>

        <Card className="mt-8 border-border/60">
          <CardContent className="flex items-center justify-between gap-4 p-4">
            <div>
              <div className="text-sm font-semibold">Got something to sell?</div>
              <div className="mt-1 text-xs text-muted-foreground">
                List it in minutes and reach students near you.
              </div>
            </div>
            <Button onClick={handleSell}>Sell Now</Button>
          </CardContent>
        </Card>

        <div className="mt-10 space-y-6">
          <Separator />
          <section>
            <div className="text-sm font-semibold">About us</div>
            <p className="mt-2 text-sm text-muted-foreground">
              CampusBazar is a VIT-only marketplace built for student life — buy and sell essentials
              with verified students.
            </p>
          </section>
          <section>
            <div className="text-sm font-semibold">Contact us</div>
            <p className="mt-2 text-sm text-muted-foreground">
              Email: <span className="font-medium text-foreground">support@campusbazar.com</span>
            </p>
          </section>
        </div>
      </main>

      {/* Bottom navigation (mobile-first) */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-2">
          <button
            type="button"
            className="flex flex-col items-center gap-1 text-xs text-foreground"
            onClick={() => navigate({ to: "/" })}
          >
            <Home className="h-5 w-5" />
            Home
          </button>
          <button
            type="button"
            className="flex flex-col items-center gap-1 text-xs text-muted-foreground"
            onClick={() => toast.message("Categories is coming soon")}
          >
            <Grid2X2 className="h-5 w-5" />
            Categories
          </button>

          <button
            type="button"
            className="-mt-8 rounded-full bg-primary p-4 text-primary-foreground shadow-lg"
            onClick={handleSell}
            aria-label="Sell"
          >
            <Plus className="h-6 w-6" />
          </button>

          <button
            type="button"
            className="flex flex-col items-center gap-1 text-xs text-muted-foreground"
            onClick={() => handleDisabled("Chats")}
          >
            <MessageSquare className="h-5 w-5" />
            Chats
          </button>
          <button
            type="button"
            className="flex flex-col items-center gap-1 text-xs text-muted-foreground"
            onClick={handleProfileTap}
          >
            <User className="h-5 w-5" />
            Profile
          </button>
        </div>
      </nav>

      {/* Mobile top-right icons (wishlist/chats/profile), shown below header on small screens */}
      <div className="fixed right-3 top-[64px] z-30 flex gap-2 sm:hidden">
        <Button
          variant="secondary"
          size="icon"
          className="h-10 w-10 rounded-full shadow"
          onClick={() => {
            if (!user) navigate({ to: "/login" });
            else navigate({ to: "/wishlist" });
          }}
          aria-label="Wishlist"
        >
          <Heart className="h-5 w-5" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          className="h-10 w-10 rounded-full shadow"
          onClick={() => handleDisabled("Chats")}
          aria-label="Chats"
        >
          <MessageSquare className="h-5 w-5" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          className="h-10 w-10 rounded-full shadow"
          onClick={handleProfileTap}
          aria-label="Profile"
        >
          <User className="h-5 w-5" />
        </Button>
      </div>

      {isAdmin && (
        <div className="fixed left-3 top-[64px] z-30 sm:hidden">
          <Badge variant="secondary">Admin</Badge>
        </div>
      )}

      <Dialog open={profilePickerOpen} onOpenChange={setProfilePickerOpen}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Choose profile</DialogTitle>
            <DialogDescription>
              User profile is private. Seller profile is public.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 pt-1">
            <Button className="w-full justify-start" onClick={openUserProfile}>
              User Profile
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={openSellerProfile}>
              Seller Profile
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
