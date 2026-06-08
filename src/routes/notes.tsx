import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Plus, Search } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth";
import { getNotesCategoryLabel } from "@/lib/notes-categories";
import ListingActions from "@/components/listing/listing-actions";
import { NotesCategoryFilterBar } from "@/components/notes/notes-category-filter-bar";
import { NotesHero } from "@/components/notes/notes-hero";
import { NotesEmptyState, NotesLoadingGrid } from "@/components/notes/notes-empty-state";
import { NotesListingCard } from "@/components/notes/notes-listing-card";
import { NotesRequestCard } from "@/components/notes/notes-request-card";
import { NotesTrustBar } from "@/components/notes/notes-trust-bar";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HubNavStrip } from "@/components/hub-nav-strip";

export const Route = createFileRoute("/notes")({
  head: () => ({
    meta: [{ title: "Notes Hub — CampusBazar" }],
  }),
  component: NotesHubPage,
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
  is_digital: boolean;
  is_free: boolean;
  status: string;
  seller_id: string;
  created_at: string;
};

type NotesRequestRow = {
  id: string;
  requester_id: string;
  subject: string;
  request_type: string;
  description: string;
  urgency_level: string;
  semester: string | null;
  branch: string | null;
  status: string;
  created_at: string;
};

const NOTES_LISTINGS_TABLE = "notes_listings" as unknown as keyof Database["public"]["Tables"];
const NOTES_REQUESTS_TABLE = "notes_requests" as unknown as keyof Database["public"]["Tables"];

function NotesHubPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"sell" | "rent" | "requests">("sell");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const { data: listings, isLoading: loadingListings } = useQuery({
    queryKey: ["notes", "listings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(NOTES_LISTINGS_TABLE)
        .select(
          "id,listing_type,title,description,category,subject,faculty,semester,branch,daily_rental_price,is_digital,is_free,status,seller_id,created_at",
        )
        .eq("status", "available")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as NotesListingRow[];
    },
    refetchInterval: 5000,
  });

  const { data: requests, isLoading: loadingRequests } = useQuery({
    queryKey: ["notes", "requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(NOTES_REQUESTS_TABLE)
        .select(
          "id,requester_id,subject,request_type,description,urgency_level,semester,branch,status,created_at",
        )
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as NotesRequestRow[];
    },
    refetchInterval: 5000,
  });

  const filteredListings = useMemo(() => {
    let items = (listings ?? []).filter((l) => l.listing_type === tab);

    if (categoryFilter !== "all") {
      items = items.filter((l) => l.category === categoryFilter);
    }

    const q = query.trim().toLowerCase();
    if (!q) return items;

    return items.filter((l) => {
      return (
        l.title.toLowerCase().includes(q) ||
        l.category.toLowerCase().includes(q) ||
        (l.subject ?? "").toLowerCase().includes(q) ||
        (l.faculty ?? "").toLowerCase().includes(q)
      );
    });
  }, [listings, query, tab, categoryFilter]);

  const filteredRequests = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = requests ?? [];
    if (!q) return base;
    return base.filter((r) => {
      return (
        r.subject.toLowerCase().includes(q) ||
        r.request_type.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q)
      );
    });
  }, [requests, query]);

  const hubStats = useMemo(() => {
    const all = listings ?? [];
    return {
      total: all.length,
      subjects: new Set(all.map((l) => l.subject).filter(Boolean)).size,
      sellers: new Set(all.map((l) => l.seller_id)).size,
    };
  }, [listings]);

  const formatInr = (amount: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(amount);

  const openDetailsForm = (mode: "sell" | "rent" | "requests") => {
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    if (mode === "requests") {
      navigate({ to: "/upload-notes-request" });
      return;
    }
    navigate({ to: "/upload-notes", search: { type: mode } as never });
  };

  const handleTabChange = (value: string) => {
    setTab(value as typeof tab);
    setCategoryFilter("all");
  };

  const hasSearchQuery = query.trim().length > 0;
  const hasCategoryFilter = categoryFilter !== "all";
  const hasActiveFilters = hasSearchQuery || hasCategoryFilter;
  const showCategoryBar = tab === "sell" || tab === "rent";

  const listingsSectionTitle = hasCategoryFilter
    ? getNotesCategoryLabel(categoryFilter)
    : "Recent Listings";

  const listingsSectionSubtitle = (() => {
    if (hasCategoryFilter && hasSearchQuery) {
      return `Showing ${getNotesCategoryLabel(categoryFilter)} matching your search`;
    }
    if (hasCategoryFilter) {
      return `Listings in ${getNotesCategoryLabel(categoryFilter)}`;
    }
    if (tab === "rent") {
      return "Rent notes for a few days without buying";
    }
    return "Fresh notes posted by students on campus";
  })();

  const createLabel =
    tab === "requests" ? "New Request" : tab === "rent" ? "Rent Notes" : "Sell Notes";

  const renderListingsGrid = (listingType: "sell" | "rent") => {
    if (loadingListings) return <NotesLoadingGrid />;

    if (filteredListings.length) {
      return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredListings.map((l) => (
            <NotesListingCard
              key={l.id}
              listing={{ ...l, listing_type: listingType }}
              formatInr={formatInr}
              onClick={() => navigate({ to: "/notes/$id", params: { id: l.id } })}
              actions={
                listingType === "sell" ? (
                  <ListingActions
                    itemType="notes"
                    itemId={l.id}
                    ownerId={l.seller_id}
                    onEdit={() => {
                      console.log("[ListingActions] onEdit notes", l.id);
                      window.location.assign(`/upload-notes?edit=${l.id}`);
                    }}
                  />
                ) : undefined
              }
            />
          ))}
        </div>
      );
    }

    return (
      <NotesEmptyState
        title={
          hasActiveFilters
            ? "No matching listings"
            : listingType === "rent"
              ? "No rental notes yet"
              : "No notes listings yet"
        }
        description={
          hasActiveFilters
            ? "Try a different category or clear your search to see more notes."
            : listingType === "rent"
              ? "List your notes for rent and help another student this semester."
              : "Be the first to share your notes with fellow VIT students."
        }
        actionLabel={hasActiveFilters ? undefined : listingType === "rent" ? "Rent details" : "Sell details"}
        onAction={
          hasActiveFilters
            ? undefined
            : () => openDetailsForm(listingType === "rent" ? "rent" : "sell")
        }
        isSearchEmpty={hasActiveFilters}
      />
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/[0.04] via-background to-background pb-24">
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 rounded-full text-muted-foreground"
            aria-label="Back"
            onClick={() => navigate({ to: "/" })}
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Home</span>
          </Button>
          <Button
            className="rounded-full shadow-md shadow-primary/20"
            onClick={() => openDetailsForm(tab)}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            {createLabel}
          </Button>
        </div>

        <NotesHero
          totalListings={hubStats.total}
          subjectCount={hubStats.subjects}
          activeSellers={hubStats.sellers}
          className="mb-6"
        />

        <HubNavStrip active="notes" className="mb-6" />

        <Tabs value={tab} onValueChange={handleTabChange}>
          <TabsList className="mb-6 grid h-11 w-full grid-cols-3 rounded-2xl bg-muted/50 p-1">
            <TabsTrigger
              value="sell"
              className="rounded-xl data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm"
            >
              Sell
            </TabsTrigger>
            <TabsTrigger
              value="rent"
              className="rounded-xl data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm"
            >
              Rent
            </TabsTrigger>
            <TabsTrigger
              value="requests"
              className="rounded-xl data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm"
            >
              Requests
            </TabsTrigger>
          </TabsList>

          {showCategoryBar && (
            <NotesCategoryFilterBar
              tab={tab}
              categoryFilter={categoryFilter}
              onCategoryChange={setCategoryFilter}
              className="mb-6"
            />
          )}

          <div className="sticky top-14 z-30 mb-6">
            <div className="rounded-2xl border border-border/50 bg-card/80 p-3 shadow-md shadow-black/[0.03] backdrop-blur-xl sm:p-4">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-12 rounded-2xl border-border/50 bg-background/80 pl-11 text-base shadow-inner"
                  placeholder="Search notes, subjects, books..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="mb-6 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Button
              variant="outline"
              className="h-11 rounded-2xl border-border/50 bg-card/50 shadow-sm transition-all hover:border-primary/30 hover:bg-primary/5"
              onClick={() => openDetailsForm("sell")}
            >
              Sell details
            </Button>
            <Button
              variant="outline"
              className="h-11 rounded-2xl border-border/50 bg-card/50 shadow-sm transition-all hover:border-primary/30 hover:bg-primary/5"
              onClick={() => openDetailsForm("rent")}
            >
              Rent details
            </Button>
            <Button
              variant="outline"
              className="h-11 rounded-2xl border-border/50 bg-card/50 shadow-sm transition-all hover:border-primary/30 hover:bg-primary/5"
              onClick={() => openDetailsForm("requests")}
            >
              Request details
            </Button>
          </div>

          <TabsContent value="sell" className="mt-0">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-foreground">
                  {listingsSectionTitle}
                </h2>
                <p className="text-xs text-muted-foreground sm:text-sm">{listingsSectionSubtitle}</p>
              </div>
              <span className="shrink-0 rounded-full border border-border/50 bg-muted/40 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                {filteredListings.length} {filteredListings.length === 1 ? "listing" : "listings"}
              </span>
            </div>
            {renderListingsGrid("sell")}
          </TabsContent>

          <TabsContent value="rent" className="mt-0">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-foreground">
                  {listingsSectionTitle}
                </h2>
                <p className="text-xs text-muted-foreground sm:text-sm">{listingsSectionSubtitle}</p>
              </div>
              <span className="shrink-0 rounded-full border border-border/50 bg-muted/40 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                {filteredListings.length} {filteredListings.length === 1 ? "listing" : "listings"}
              </span>
            </div>
            {renderListingsGrid("rent")}
          </TabsContent>

          <TabsContent value="requests" className="mt-0">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-foreground">
                  Open Requests
                </h2>
                <p className="text-xs text-muted-foreground sm:text-sm">
                  Students looking for specific notes and materials
                </p>
              </div>
              <span className="shrink-0 rounded-full border border-border/50 bg-muted/40 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                {filteredRequests.length}{" "}
                {filteredRequests.length === 1 ? "request" : "requests"}
              </span>
            </div>

            {loadingRequests ? (
              <div className="flex justify-center py-16 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : filteredRequests.length ? (
              <div className="space-y-4">
                {filteredRequests.map((r) => (
                  <NotesRequestCard
                    key={r.id}
                    request={r}
                    onRespond={() => toast.message("Respond (chat) is coming soon")}
                    onMarkFulfilled={() => toast.message("Mark fulfilled is coming soon")}
                  />
                ))}
              </div>
            ) : (
              <NotesEmptyState
                title={hasSearchQuery ? "No matching requests" : "No requests yet"}
                description={
                  hasSearchQuery
                    ? "Try different keywords or clear your search."
                    : "Post a request and let sellers find you on campus."
                }
                actionLabel={hasSearchQuery ? undefined : "Request details"}
                onAction={hasSearchQuery ? undefined : () => openDetailsForm("requests")}
                isSearchEmpty={hasSearchQuery}
              />
            )}
          </TabsContent>
        </Tabs>

        <NotesTrustBar className="mt-12" />
      </div>
    </div>
  );
}
