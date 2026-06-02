import { createFileRoute } from "@tanstack/react-router";
import { Package, CalendarClock, Heart, Star, Plus, Store } from "lucide-react";

import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [{ title: "Dashboard — CampusBazar" }],
  }),
  component: DashboardPage,
});

const stats = [
  { label: "Active listings", value: 0, icon: Package },
  { label: "Active rentals", value: 0, icon: CalendarClock },
  { label: "Wishlist items", value: 0, icon: Heart },
  { label: "Seller rating", value: "—", icon: Star },
];

function DashboardPage() {
  const { profile, isAdmin } = useAuth();
  const firstName = (profile?.full_name ?? "there").split(" ")[0];

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Welcome back, {firstName} 👋</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Here's what's happening with your CampusBazar account.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && <Badge variant="secondary">Admin</Badge>}
          <Button disabled>
            <Plus className="h-4 w-4" />
            New listing
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.label}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center gap-3 py-14 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-primary">
            <Store className="h-6 w-6" />
          </span>
          <div>
            <h2 className="text-lg font-semibold">Your marketplace is coming together</h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Listings, rentals, chat and your seller storefront will appear here as those features
              roll out.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
