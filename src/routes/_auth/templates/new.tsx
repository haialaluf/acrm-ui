import { createFileRoute } from "@tanstack/react-router";
import { LoaderCircle } from "lucide-react";
import SectionHeader from "@/components/SectionHeader";
import IntegrationGate from "@/components/IntegrationGate";
import TemplateEditor from "@/components/TemplateEditor";
import { useTranslation } from "@/hooks/useTranslation";
import { useIntegrations } from "@/hooks/useIntegrations";

export const Route = createFileRoute("/_auth/templates/new")({
  component: () => (
    <IntegrationGate surface="/templates/new">
      <NewTemplateBody />
    </IntegrationGate>
  ),
});

// A separate component so the gate decides before any of this mounts:
// the body's queries and early returns never run for an organization
// that is about to be redirected.
function NewTemplateBody() {
  const { translate: t } = useTranslation();
  const { rows, isLoading } = useIntegrations();
  const address = rows.whatsapp?.address;

  return (
    <>
      <SectionHeader title={t("Create template")} />
      {/* Inside the gate a connected number is guaranteed, so the only state
          left to wait on is the query that resolves which one. */}
      {isLoading || !address ? (
        <div className="flex h-full items-center justify-center">
          <LoaderCircle className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <TemplateEditor organizationAddress={address} />
      )}
    </>
  );
}
