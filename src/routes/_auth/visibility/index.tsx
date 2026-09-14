import { createFileRoute } from "@tanstack/react-router";
import VisibilityDashboard from "@/components/visibility/VisibilityDashboard";

export const Route = createFileRoute("/_auth/visibility/")({
  component: VisibilityDashboard,
});
