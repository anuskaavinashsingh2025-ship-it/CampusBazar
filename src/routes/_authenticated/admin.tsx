import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Star, Search, Trash2, CheckCircle2, Clock, MessageCircle } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useAllFeedback, useUpdateFeedbackStatus, useDeleteFeedback, FEEDBACK_CATEGORIES, type FeedbackStatus } from "@/lib/feedback";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [{ title: "Admin Portal — CampusBazar" }],
  }),
  component: AdminPortalPage,
});

type ReportRow = {
  id: string;
  target_type: "product" | "seller";
  product_id: string | null;
  seller_user_id: string | null;
  reason: string;
  details: string | null;
  status: "pending" | "resolved" | "dismissed";
  created_at: string;
  reporter_id: string;
};

function AdminPortalPage() {
  const navigate = useNavigate();
  const { isAdmin, user, loading } = useAuth();
  const queryClient = useQueryClient();
  const [feedbackSearch, setFeedbackSearch] = useState("");
  const [feedbackStatusFilter, setFeedbackStatusFilter] = useState<string>("all");
  const [feedbackCategoryFilter, setFeedbackCategoryFilter] = useState<string>("all");
  const [feedbackRatingFilter, setFeedbackRatingFilter] = useState<string>("all");
  const [adminNotes, setAdminNotes] = useState("");
  const [selectedFeedbackId, setSelectedFeedbackId] = useState<string | null>(null);

  const { data: allFeedback } = useAllFeedback();
  const updateFeedbackStatus = useUpdateFeedbackStatus();
  const deleteFeedback = useDeleteFeedback();

  useEffect(() => {
    if (!loading && !isAdmin) {
      navigate({ to: "/dashboard" });
    }
  }, [loading, isAdmin, navigate]);

  const { data: analytics } = useQuery({
    queryKey: ["admin", "analytics"],
    queryFn: async () => {
      const [
        { count: totalUsers },
        { count: totalProducts },
        { count: pendingReports },
        { count: bannedUsers },
        { count: suspicious },
      ] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("product_listings" as never).select("*", { count: "exact", head: true }),
        supabase
          .from("reports" as never)
          .select("*", { count: "exact", head: true })
          .eq("status", "pending"),
        supabase
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .eq("status", "banned"),
        supabase
          .from("suspicious_flags" as never)
          .select("*", { count: "exact", head: true })
          .eq("resolved", false),
      ]);

      return {
        totalUsers: totalUsers ?? 0,
        totalProducts: totalProducts ?? 0,
        pendingReports: pendingReports ?? 0,
        bannedUsers: bannedUsers ?? 0,
        suspicious: suspicious ?? 0,
      };
    },
    enabled: isAdmin,
    refetchInterval: 5000,
  });

  const { data: reports } = useQuery({
    queryKey: ["admin", "reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reports" as never)
        .select(
          "id,target_type,product_id,seller_user_id,reason,details,status,created_at,reporter_id",
        )
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as ReportRow[];
    },
    enabled: isAdmin,
    refetchInterval: 5000,
  });

  const pending = useMemo(() => (reports ?? []).filter((r) => r.status === "pending"), [reports]);

  const filteredFeedback = useMemo(() => {
    if (!allFeedback) return [];
    return allFeedback.filter((feedback) => {
      const matchesSearch = 
        feedback.message.toLowerCase().includes(feedbackSearch.toLowerCase()) ||
        feedback.category.toLowerCase().includes(feedbackSearch.toLowerCase());
      const matchesStatus = feedbackStatusFilter === "all" || feedback.status === feedbackStatusFilter;
      const matchesCategory = feedbackCategoryFilter === "all" || feedback.category === feedbackCategoryFilter;
      const matchesRating = feedbackRatingFilter === "all" || feedback.rating === parseInt(feedbackRatingFilter);
      return matchesSearch && matchesStatus && matchesCategory && matchesRating;
    });
  }, [allFeedback, feedbackSearch, feedbackStatusFilter, feedbackCategoryFilter, feedbackRatingFilter]);

  const handleStatusUpdate = (feedbackId: string, status: FeedbackStatus) => {
    updateFeedbackStatus.mutate({
      feedbackId,
      status,
      adminNotes: adminNotes || undefined,
    });
    setAdminNotes("");
    setSelectedFeedbackId(null);
  };

  const handleDeleteFeedback = (feedbackId: string) => {
    if (confirm("Are you sure you want to delete this feedback?")) {
      deleteFeedback.mutate(feedbackId);
    }
  };

  const getStatusBadge = (status: FeedbackStatus) => {
    switch (status) {
      case "submitted":
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Submitted</Badge>;
      case "under_review":
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Under Review</Badge>;
      case "resolved":
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Resolved</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const updateReportStatus = async (id: string, status: "resolved" | "dismissed") => {
    const { error } = await supabase
      .from("reports" as never)
      .update({
        status,
        resolved_by: user?.id ?? null,
        resolved_at: new Date().toISOString(),
      } as never)
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["admin"] });
    toast.success(`Report ${status}`);
  };

  const removeProduct = async (productId: string) => {
    const { error } = await supabase
      .from("product_listings" as never)
      .delete()
      .eq("id", productId);
    if (error) {
      toast.error(error.message);
      return;
    }
    await supabase.from("admin_actions" as never).insert({
      admin_user_id: user?.id,
      action_type: "remove_product",
      product_id: productId,
      notes: "Removed via admin portal",
    } as never);
    queryClient.invalidateQueries({ queryKey: ["admin"] });
    toast.success("Product removed");
  };

  const setUserStatus = async (
    targetUserId: string,
    status: "suspended" | "banned",
    actionType: "suspend_user" | "ban_user",
  ) => {
    const { error } = await supabase.from("profiles").update({ status }).eq("id", targetUserId);
    if (error) {
      toast.error(error.message);
      return;
    }
    await supabase.from("admin_actions" as never).insert({
      admin_user_id: user?.id,
      action_type: actionType,
      target_user_id: targetUserId,
      notes: `Set status to ${status}`,
    } as never);
    queryClient.invalidateQueries({ queryKey: ["admin"] });
    toast.success(`User ${status}`);
  };

  if (loading || !isAdmin) {
    return (
      <div className="mx-auto max-w-3xl py-10 text-center text-sm text-muted-foreground">
        {loading ? "Loading…" : "Redirecting…"}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 py-2">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Admin Portal</h1>
        <p className="mt-1 text-sm text-muted-foreground">Trust, safety and moderation controls.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Total users" value={analytics?.totalUsers ?? 0} />
        <StatCard label="Total products" value={analytics?.totalProducts ?? 0} />
        <StatCard label="Pending reports" value={analytics?.pendingReports ?? 0} />
        <StatCard label="Banned users" value={analytics?.bannedUsers ?? 0} />
        <StatCard label="Suspicious flags" value={analytics?.suspicious ?? 0} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Report Queue</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {pending.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No pending reports.
            </div>
          ) : (
            pending.map((r) => (
              <div key={r.id} className="rounded-xl border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{r.target_type}</Badge>
                  <Badge variant="outline">{r.reason}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleString()}
                  </span>
                </div>
                {r.details && <div className="mt-2 text-sm text-muted-foreground">{r.details}</div>}

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => updateReportStatus(r.id, "resolved")}>
                    Resolve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => updateReportStatus(r.id, "dismissed")}
                  >
                    Dismiss
                  </Button>

                  {r.target_type === "product" && r.product_id && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => removeProduct(r.product_id!)}
                    >
                      Remove Product
                    </Button>
                  )}

                  {r.target_type === "seller" && r.seller_user_id && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setUserStatus(r.seller_user_id!, "suspended", "suspend_user")
                        }
                      >
                        Suspend User
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setUserStatus(r.seller_user_id!, "banned", "ban_user")}
                      >
                        Ban User
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Feedback Management
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search feedback..."
                  value={feedbackSearch}
                  onChange={(e) => setFeedbackSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={feedbackStatusFilter} onValueChange={setFeedbackStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="under_review">Under Review</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>
            <Select value={feedbackCategoryFilter} onValueChange={setFeedbackCategoryFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {FEEDBACK_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={feedbackRatingFilter} onValueChange={setFeedbackRatingFilter}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Rating" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Ratings</SelectItem>
                <SelectItem value="5">5 Stars</SelectItem>
                <SelectItem value="4">4 Stars</SelectItem>
                <SelectItem value="3">3 Stars</SelectItem>
                <SelectItem value="2">2 Stars</SelectItem>
                <SelectItem value="1">1 Star</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Feedback List */}
          {filteredFeedback.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No feedback found.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredFeedback.map((feedback: any) => (
                <div key={feedback.id} className="rounded-xl border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <div className="flex">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`h-4 w-4 ${
                                star <= feedback.rating
                                  ? "fill-orange-500 text-orange-500"
                                  : "text-gray-300"
                              }`}
                            />
                          ))}
                        </div>
                        <Badge variant="outline">{feedback.category}</Badge>
                        {getStatusBadge(feedback.status)}
                        <span className="text-xs text-muted-foreground">
                          {new Date(feedback.created_at).toLocaleString()}
                        </span>
                      </div>
                      
                      <div className="mb-2">
                        <span className="text-sm font-medium">
                          User ID: {feedback.user_id}
                        </span>
                      </div>
                      
                      <p className="text-sm text-gray-700">{feedback.message}</p>
                      
                      {feedback.screenshot_url && (
                        <img
                          src={feedback.screenshot_url}
                          alt="Screenshot"
                          className="mt-2 h-24 w-24 rounded border border-gray-300 object-cover"
                        />
                      )}
                      
                      {feedback.admin_notes && (
                        <div className="mt-2 rounded bg-blue-50 p-2 text-sm text-blue-700">
                          <span className="font-semibold">Admin Note:</span> {feedback.admin_notes}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex flex-col gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="outline" onClick={() => setSelectedFeedbackId(feedback.id)}>
                            Add Notes
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Add Admin Notes</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <Textarea
                              placeholder="Enter admin notes..."
                              value={selectedFeedbackId === feedback.id ? adminNotes : ""}
                              onChange={(e) => setAdminNotes(e.target.value)}
                              className="min-h-[100px]"
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleStatusUpdate(feedback.id, "under_review")}
                              >
                                Mark Under Review
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleStatusUpdate(feedback.id, "resolved")}
                              >
                                Mark Resolved
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                      
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeleteFeedback(feedback.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}
