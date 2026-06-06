import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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
