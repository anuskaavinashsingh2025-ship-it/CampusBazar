import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Store } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { ensureSellerProfile } from "@/lib/supabase-account";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/seller-profile")({
  head: () => ({
    meta: [{ title: "Seller Profile — CampusBazar" }],
  }),
  component: SellerProfileEditPage,
});

function SellerProfileEditPage() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const defaultDisplayName = useMemo(() => {
    if (profile?.full_name?.trim()) return profile.full_name.trim();
    return user?.email ?? "seller";
  }, [profile?.full_name, user?.email]);

  const { data: seller, isLoading } = useQuery({
    queryKey: ["seller_profile_self", user?.id ?? null],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("seller_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: Boolean(user?.id),
  });

  useEffect(() => {
    if (seller) {
      setDisplayName(seller.display_name);
      setBio(seller.bio ?? "");
      setAvatarUrl(seller.avatar_url ?? "");
    } else {
      setDisplayName(defaultDisplayName);
      setBio("");
      setAvatarUrl(profile?.avatar_url ?? "");
    }
  }, [seller, defaultDisplayName, profile?.avatar_url]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    try {
      if (!seller) {
        await ensureSellerProfile({
          user_id: user.id,
          display_name: displayName.trim() || defaultDisplayName,
          avatar_url: avatarUrl.trim() || profile?.avatar_url || null,
        });
      }

      const { error } = await supabase
        .from("seller_profiles")
        .update({
          display_name: displayName.trim() || defaultDisplayName,
          bio: bio.trim() || null,
          avatar_url: avatarUrl.trim() || null,
        })
        .eq("user_id", user.id);

      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["seller_profile_self", user.id] });
      toast.success("Seller profile saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save seller profile");
    } finally {
      setSubmitting(false);
    }
  };

  if (!user || isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Seller profile</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Public storefront details shown to buyers on your listings.
          </p>
        </div>
        {seller?.slug && (
          <Button variant="outline" size="sm" asChild>
            <Link to="/seller/$slug" params={{ slug: seller.slug }}>
              <Store className="mr-2 h-4 w-4" />
              View storefront
            </Link>
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Storefront details</CardTitle>
          <CardDescription>
            {seller
              ? "Update how other students see you on CampusBazar."
              : "Create your seller profile to start listing items."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {seller?.slug && (
              <div className="space-y-2">
                <Label>Store URL</Label>
                <Input value={`/seller/${seller.slug}`} disabled />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="displayName">Display name</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell buyers about what you sell or rent on campus."
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="avatarUrl">Avatar URL (optional)</Label>
              <Input
                id="avatarUrl"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save seller profile
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
