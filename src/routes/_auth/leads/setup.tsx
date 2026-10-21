import { createFileRoute } from "@tanstack/react-router";
import LeadFlowSetup from "@/components/leads/setup/LeadFlowSetup";

export const Route = createFileRoute("/_auth/leads/setup")({
  component: LeadFlowSetup,
});
