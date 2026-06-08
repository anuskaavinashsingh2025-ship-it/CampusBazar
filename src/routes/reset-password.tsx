import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { GraduationCap, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { validateSetPassword } from "@/lib/password-validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password — CampusBazar" },
      { name: "description", content: "Set or reset your CampusBazar account password." },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [ready, setReady] = useState(false);
  const [tokenValid, setTokenValid] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    password?: string;
    confirmPassword?: string;
  }>({});

  useEffect(() => {
    let cancelled = false;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === "PASSWORD_RECOVERY" && session) {
        setTokenValid(true);
      }
    });

    (async () => {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();
      if (cancelled) return;

      const params = new URLSearchParams(window.location.search);
      const hasRecoveryParams =
        params.has("code") ||
        params.has("token_hash") ||
        params.get("type") === "recovery" ||
        window.location.hash.includes("type=recovery");

      if (error) {
        console.error("[reset-password] getSession:", error.message);
      }

      if (session && hasRecoveryParams) {
        setTokenValid(true);
      } else if (hasRecoveryParams && !session) {
        setTokenValid(false);
      }

      setReady(true);

      if (hasRecoveryParams) {
        window.history.replaceState({}, "", "/reset-password");
      }
    })();

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFieldErrors({});

    const parsed = validateSetPassword({ password, confirmPassword });
    if (!parsed.success) {
      const errors: { password?: string; confirmPassword?: string } = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (key === "password" || key === "confirmPassword") {
          errors[key] = issue.message;
        }
      }
      setFieldErrors(errors);
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
      if (error) throw error;

      await supabase.auth.signOut();
      toast.success("Password updated! You can sign in with Google or your email and password.");
      navigate({ to: "/login" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not update password";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-secondary via-background to-accent/40 px-4 py-12">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <GraduationCap className="h-6 w-6" />
          </span>
          <span className="text-2xl font-bold tracking-tight text-foreground">CampusBazar</span>
        </Link>

        <Card className="border-border/60 shadow-lg">
          {!tokenValid ? (
            <>
              <CardHeader className="space-y-1 text-center">
                <CardTitle className="text-2xl">Link expired</CardTitle>
                <CardDescription>
                  This password reset link is invalid, expired, or has already been used.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full" asChild>
                  <Link to="/login">Back to sign in</Link>
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  Request a new link from the sign-in page if you signed up with Google.
                </p>
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader className="space-y-1 text-center">
                <CardTitle className="text-2xl">Set your password</CardTitle>
                <CardDescription>
                  Choose a password for your account. You can still sign in with Google afterward.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="password">New password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      required
                    />
                    {fieldErrors.password ? (
                      <p className="text-xs text-destructive">{fieldErrors.password}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        At least 8 characters with uppercase, lowercase, and a number.
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      required
                    />
                    {fieldErrors.confirmPassword ? (
                      <p className="text-xs text-destructive">{fieldErrors.confirmPassword}</p>
                    ) : null}
                  </div>

                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    Save password
                  </Button>
                </form>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
