import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { GraduationCap, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { HOSTEL_BLOCKS } from "@/lib/hostel-blocks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/complete-profile")({
  head: () => ({
    meta: [
      { title: "Complete your profile — CampusBazar" },
      { name: "description", content: "Finish setting up your CampusBazar profile." },
    ],
  }),
  component: CompleteProfilePage,
});

function CompleteProfilePage() {
  const navigate = useNavigate();
  const { user, profile, loading, isProfileComplete, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState("");
  const [hostelBlock, setHostelBlock] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/login" });
    } else if (isProfileComplete) {
      navigate({ to: "/" });
    }
  }, [loading, user, isProfileComplete, navigate]);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? "");
      setHostelBlock(profile.hostel_block ?? "");
    }
  }, [profile]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    try {
      const payload = {
        full_name: fullName.trim(),
        hostel_block: hostelBlock,
        is_profile_complete: true,
      };
      const { error } = profile
        ? await supabase.from("profiles").update(payload).eq("id", user.id)
        : await supabase.from("profiles").insert({
            id: user.id,
            email: user.email ?? "",
            ...payload,
          });
      if (error) throw error;
      await refreshProfile();
      toast.success("Profile completed!");
      navigate({ to: "/" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save profile";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const filled = [fullName.trim(), hostelBlock].filter(Boolean).length;
  const progress = (filled / 2) * 100;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-secondary via-background to-accent/40 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <GraduationCap className="h-6 w-6" />
          </span>
          <span className="text-2xl font-bold tracking-tight text-foreground">CampusBazar</span>
        </div>

        <Card className="border-border/60 shadow-lg">
          <CardHeader className="space-y-3">
            <div className="space-y-1">
              <CardTitle className="text-2xl">Complete your profile</CardTitle>
              <CardDescription>
                Tell us a bit about yourself before you start buying and selling.
              </CardDescription>
            </div>
            <Progress value={progress} />
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={profile?.email ?? user.email ?? ""} disabled />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fullName">Full name</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Aditi Sharma"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="hostelBlock">Hostel block</Label>
                <select
                  id="hostelBlock"
                  value={hostelBlock}
                  onChange={(e) => setHostelBlock(e.target.value)}
                  required
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="" disabled>
                    Select your block
                  </option>
                  {HOSTEL_BLOCKS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Save and continue
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
