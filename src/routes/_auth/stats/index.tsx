import { createFileRoute } from "@tanstack/react-router";

// Bare `/stats` renders nothing of its own — the Stats layout (`stats.tsx`)
// supplies the list panel, and the center panel defaults to Quotas. On mobile
// this is the list-first landing (menu rail + Cuotas/Uso), from which a tab
// opens full-screen; on desktop the list + Quotas show side by side.
export const Route = createFileRoute("/_auth/stats/")({
  component: () => null,
});
