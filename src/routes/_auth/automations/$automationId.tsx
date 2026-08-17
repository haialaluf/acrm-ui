import { createFileRoute } from "@tanstack/react-router";
import AutomationEditor from "@/components/automations/AutomationEditor";

export const Route = createFileRoute("/_auth/automations/$automationId")({
  component: EditAutomation,
});

function EditAutomation() {
  const { automationId } = Route.useParams();

  return <AutomationEditor id={automationId} />;
}
