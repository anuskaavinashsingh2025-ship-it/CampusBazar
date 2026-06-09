import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Loader2,
  Search,
  Plus,
  BookOpen,
  FileText,
  FlaskConical,
  HelpCircle,
  Layers,
  Package,
  Archive,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth";
import { useRespondToNotesRequest } from "@/lib/notes-respond";
import ListingActions from "@/components/listing/listing-actions";
import { CampusBazarLogo } from "@/components/brand/campusbazar-logo";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HubNavStrip } from "@/components/hub-nav-strip";
import { cn } from "@/lib/utils";

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

const CATEGORY_OPTIONS = [
  { key: "Handwritten Notes", icon: FileText, color: "bg-blue-100 text-blue-600" },
  { key: "Previous Year Questions (PYQs)", icon: HelpCircle, color: "bg-purple-100 text-purple-600" },
  { key: "Cheat Sheets", icon: Layers, color: "bg-orange-100 text-orange-600" },
  { key: "Textbooks", icon: BookOpen, color: "bg-green-100 text-green-600" },
  { key: "Lab Material", icon: FlaskConical, color: "bg-sky-100 text-sky-600" },
  { key: "Exam Kits", icon: Package, color: "bg-amber-100 text-amber-600" },
] as const;

function NotesHubPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"sell" | "rent" | "requests">("sell");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Notes Request → Chat integration.
  // When a seller clicks "Respond" on a request, this hook:
  //   1. finds-or-creates a conversation in the existing `conversations`
  //      table (reusing the same chat infrastructure as every other hub).
  //   2. inserts the initial system message and the auto first message.
  //   3. marks the request as "in_progress".
  //   4. invalidates the relevant React Query caches.
  // The mutation's `onSuccess` then navigates to /chats/$id.
  const respond = useRespondToNotesRequest();

  const handleRespond = (r: NotesRequestRow) => {
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    if (user.id === r.requester_id) {
      toast.error("You cannot respond to your own notes request.");
      return;
    }
    respond.mutate(
      {
        requestId: r.id,
        requestCreatorId: r.requester_id,
        requestSubject: r.subject,
        responderId: user.id,
      },
      {
        onSuccess: ({ conversationId }) => {
          if (conversationId) {
            navigate({
              to: "/chats/$id",
              params: { id: conversationId },
              search: { focus: "1" } as never,
            });
          }
        },
      },
    );
  };

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
    const q = query.trim().toLowerCase();
    let base = (listings ?? []).filter((l) => l.listing_type === tab);
    
    // Apply category filter
    if (categoryFilter !== "all") {
      base = base.filter((l) => l.category === categoryFilter);
    }
    
    if (!q) return base;
    return base.filter((l) => {
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
          <Link
            to="/"
            aria-label="CampusBazar home"
            className="flex items-center justify-center"
          >
            <CampusBazarLogo compact showText={false} />
          </Link>

          <div className="relative ml-auto flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="h-10 rounded-full bg-background pl-9"
              placeholder="Search subjects, faculty, keywords..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <Button
            size="icon"
            className="rounded-full"
            aria-label="Create"
            onClick={() => openDetailsForm(tab)}
          >
            <Plus className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-4">
        <HubNavStrip active="notes" className="mb-4" />

        <section className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Browse Categories</h2>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2">
            <button
              type="button"
              onClick={() => setCategoryFilter("all")}
              className={cn(
                "flex shrink-0 flex-col items-center gap-2 rounded-xl border p-3 text-xs",
                categoryFilter === "all" ? "border-primary bg-primary/10" : "bg-card",
              )}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <BookOpen className="h-5 w-5" />
              </div>
              All
            </button>
            {CATEGORY_OPTIONS.map((cat) => (
              <button
                key={cat.key}
                type="button"
                onClick={() => setCategoryFilter(categoryFilter === cat.key ? "all" : cat.key)}
                className={cn(
                  "flex shrink-0 flex-col items-center gap-2 rounded-xl border p-3 text-xs",
                  categoryFilter === cat.key ? "border-primary bg-primary/10" : "bg-card",
                )}
              >
                <div
                  className={cn("flex h-10 w-10 items-center justify-center rounded-lg", cat.color)}
                >
                  <cat.icon className="h-5 w-5" />
                </div>
                {cat.key.split(" ")[0]}
              </button>
            ))}
          </div>
        </section>

        <div className="mb-3 grid grid-cols-3 gap-2">
          <Button variant="outline" onClick={() => openDetailsForm("sell")}>
            Sell details
          </Button>
          <Button variant="outline" onClick={() => openDetailsForm("rent")}>
            Rent details
          </Button>
          <Button variant="outline" onClick={() => openDetailsForm("requests")}>
            Request details
          </Button>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="sell">Sell</TabsTrigger>
            <TabsTrigger value="rent">Rent</TabsTrigger>
            <TabsTrigger value="requests">Requests</TabsTrigger>
          </TabsList>

          <TabsContent value="sell" className="mt-4">
            {loadingListings ? (
              <div className="flex justify-center py-16 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : filteredListings.length ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filteredListings.map((l) => (
                  <Card
                    key={l.id}
                    className="border-border/60 shadow-sm"
                    onClick={() => navigate({ to: "/notes/$id", params: { id: l.id } })}
                  >
                    <CardContent className="space-y-2 p-4">
                      <div
                        className="absolute right-2 top-2 z-20"
                        onClick={(e) => e.stopPropagation()}
                        role="presentation"
                      >
                        <ListingActions
                          itemType="notes"
                          itemId={l.id}
                          ownerId={l.seller_id}
                          onEdit={() => {
                            console.log("[ListingActions] onEdit notes", l.id);
                            window.location.assign(`/upload-notes?edit=${l.id}`);
                          }}
                        />
                      </div>
                      <div className="text-sm font-semibold">{l.title}</div>
                      <div className="text-xs text-muted-foreground line-clamp-2">
                        {l.description}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary">{l.category}</Badge>
                        {l.is_free ? (
                          <Badge variant="outline">Free</Badge>
                        ) : (
                          <Badge variant="outline">Paid</Badge>
                        )}
                        {l.is_digital ? (
                          <Badge variant="outline">Digital</Badge>
                        ) : (
                          <Badge variant="outline">Physical</Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="py-16 text-center text-sm text-muted-foreground">
                No notes listings yet.
              </div>
            )}
          </TabsContent>

          <TabsContent value="rent" className="mt-4">
            {loadingListings ? (
              <div className="flex justify-center py-16 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : filteredListings.length ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filteredListings.map((l) => (
                  <Card
                    key={l.id}
                    className="border-border/60 shadow-sm"
                    onClick={() => navigate({ to: "/notes/$id", params: { id: l.id } })}
                  >
                    <CardContent className="space-y-2 p-4">
                      <div className="text-sm font-semibold">{l.title}</div>
                      <div className="text-xs text-muted-foreground line-clamp-2">
                        {l.description}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary">{l.category}</Badge>
                        <Badge variant="outline">
                          {l.daily_rental_price != null
                            ? `${formatInr(Number(l.daily_rental_price))} / day`
                            : "—"}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="py-16 text-center text-sm text-muted-foreground">
                No rental notes yet.
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
                          <div className="text-sm font-semibold">{r.subject}</div>
                          <div className="text-xs text-muted-foreground">{r.request_type}</div>
                        </div>
                        <Badge variant="secondary">{r.urgency_level}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">{r.description}</div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRespond(r)}
                          disabled={respond.isPending || (!!user && user.id === r.requester_id)}
                        >
                          {respond.isPending ? (
                            <>
                              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                              Opening chat…
                            </>
                          ) : (
                            "Respond"
                          )}
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => toast.message("Mark fulfilled is coming soon")}
                        >
                          Mark Fulfilled
                        </Button>
                        {r.status === "in_progress" && (
                          <Badge variant="outline" className="text-[10px]">
                            Chat opened
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="py-16 text-center text-sm text-muted-foreground">
                No requests yet.
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
