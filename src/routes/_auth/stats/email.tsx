import { createFileRoute } from "@tanstack/react-router";
import IntegrationGate from "@/components/IntegrationGate";

// Renders nothing itself, like the sibling stats routes: the center panel is
// mounted by StatsCenter, which branches on the pathname. The gate is here
// rather than in StatsCenter so the route stays the owner of its own redirect —
// the tab is already hidden from the stats list, so this only runs for a typed
// or bookmarked URL. It lands on `/stats` rather than `/integrations` to keep
// the section navigable.
export const Route = createFileRoute("/_auth/stats/email")({
  component: () => (
    <IntegrationGate surface="/stats/email" to="/stats">
      {null}
    </IntegrationGate>
  ),
});
