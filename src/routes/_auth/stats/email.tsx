import { createFileRoute } from "@tanstack/react-router";

// Renders nothing itself, like the sibling stats routes: the center panel is
// mounted by StatsCenter, which branches on the pathname.
export const Route = createFileRoute("/_auth/stats/email")({
  component: () => null,
});
