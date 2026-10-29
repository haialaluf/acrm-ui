import { createFileRoute } from "@tanstack/react-router";
import LeadsPage from "@/components/leads/LeadsPage";
import type { LeadsView } from "@/components/leads/LeadList";

const VIEWS: LeadsView[] = ["queue", "all", "board"];

type LeadsSearch = { view?: LeadsView; lead?: string };

export const Route = createFileRoute("/_auth/leads/")({
  validateSearch: (search: Record<string, unknown>): LeadsSearch => ({
    view: VIEWS.includes(search.view as LeadsView)
      ? (search.view as LeadsView)
      : undefined,
    lead: typeof search.lead === "string" ? search.lead : undefined,
  }),
  component: Leads,
});

function Leads() {
  const { view, lead } = Route.useSearch();
  const navigate = Route.useNavigate();

  return (
    <LeadsPage
      view={view ?? "queue"}
      leadId={lead ?? null}
      onNavigate={(next) =>
        navigate({
          search: (prev) => ({
            view: next.view ?? prev.view,
            lead: next.lead === null ? undefined : (next.lead ?? prev.lead),
          }),
          replace: next.view === undefined,
        })
      }
    />
  );
}
