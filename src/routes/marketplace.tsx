import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/marketplace")({
  head: () => ({
    meta: [{ title: "Marketplace — CampusBazar" }],
  }),
  component: MarketplaceRedirect,
});

function MarketplaceRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate({ to: "/" });
  }, [navigate]);

  return null;
}
