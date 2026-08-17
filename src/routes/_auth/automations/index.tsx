import { createFileRoute } from "@tanstack/react-router";
import AutomationsList from "@/components/automations/AutomationsList";

export const Route = createFileRoute("/_auth/automations/")({
  component: ListAutomations,
});

function ListAutomations() {
  return <AutomationsList />;
}
