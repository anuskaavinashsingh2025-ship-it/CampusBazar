import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const navigate = useNavigate();
  const { user, loading, isProfileComplete } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/login" });
    } else if (!isProfileComplete) {
      navigate({ to: "/complete-profile" });
    }
  }, [loading, user, isProfileComplete, navigate]);

  if (loading || !user || !isProfileComplete) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <Outlet />
    </div>
  );
}
