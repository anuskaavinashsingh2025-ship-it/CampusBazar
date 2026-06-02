import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { GraduationCap, Star, Package, CalendarClock, Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/seller/$slug")({
  head: () => ({
    meta: [
      { title: "Seller — CampusBazar" },
      { name: "description", content: "View this seller's storefront on CampusBazar." },
    ],
  }),
  component: SellerPage,
});

function SellerPage() {
  const { slug } = Route.useParams();
  const { user } = useAuth();

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

  return (
    <div className="min-h-screen bg-gradient-to-b from-secondary/60 to-background">
      <header className="border-b bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
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

      <main className="mx-auto max-w-4xl px-4 py-10">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !seller ? (
          <div className="py-20 text-center">
            <h1 className="text-2xl font-bold">Seller not found</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              We couldn't find a storefront at <span className="font-mono">/seller/{slug}</span>.
            </p>
            <Button asChild className="mt-6">
              <Link to="/">Back home</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            <Card className="overflow-hidden">
              <div className="h-28 bg-gradient-to-r from-primary to-accent" />
              <CardContent className="-mt-12 flex flex-col items-start gap-4 sm:flex-row sm:items-end">
                <Avatar className="h-24 w-24 border-4 border-card shadow">
                  {seller.avatar_url && (
                    <AvatarImage src={seller.avatar_url} alt={seller.display_name} />
                  )}
                  <AvatarFallback className="bg-primary text-xl text-primary-foreground">
                    {seller.display_name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="pb-1">
                  <h1 className="text-2xl font-bold tracking-tight">{seller.display_name}</h1>
                  <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                    <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                    <span className="font-medium text-foreground">
                      {Number(seller.rating_avg).toFixed(1)}
                    </span>
                    <span>({seller.rating_count} reviews)</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {seller.bio && (
              <Card>
                <CardContent className="pt-6">
                  <h2 className="mb-2 text-sm font-semibold uppercase text-muted-foreground">
                    About
                  </h2>
                  <p className="text-sm leading-relaxed">{seller.bio}</p>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardContent className="flex items-center gap-3 pt-6">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-primary">
                    <Package className="h-5 w-5" />
                  </span>
                  <div>
                    <div className="text-xl font-bold">{seller.total_sold}</div>
                    <div className="text-xs text-muted-foreground">Items sold</div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center gap-3 pt-6">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-primary">
                    <CalendarClock className="h-5 w-5" />
                  </span>
                  <div>
                    <div className="text-xl font-bold">{seller.total_rented_out}</div>
                    <div className="text-xs text-muted-foreground">Items rented out</div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="border-dashed">
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Listings from this seller will appear here soon.
              </CardContent>
            </Card>

            <Button
              variant="outline"
              onClick={async () => {
                if (!user) {
                  toast.error("Please login to report seller.");
                  return;
                }
                const reason = window.prompt("Reason (suspicious seller/spam/scam):", "suspicious");
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
                toast.success("Seller reported.");
              }}
            >
              Report seller
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
