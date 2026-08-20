import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LoaderCircle } from "lucide-react";
import SectionHeader from "@/components/SectionHeader";
import TemplateEditor from "@/components/TemplateEditor";
import IntegrationGate from "@/components/IntegrationGate";
import { useTranslation } from "@/hooks/useTranslation";
import { useIntegrations } from "@/hooks/useIntegrations";
import { useTemplates, useDeleteTemplate } from "@/queries/useTemplates";

export const Route = createFileRoute("/_auth/templates/$templateId")({
  component: () => (
    <IntegrationGate surface="/templates/$templateId">
      <EditTemplateBody />
    </IntegrationGate>
  ),
});

// A separate component so the gate decides before any of this mounts:
// the body's queries and early returns never run for an organization
// that is about to be redirected.
function EditTemplateBody() {
  const { translate: t } = useTranslation();
  const navigate = useNavigate();
  const { templateId } = Route.useParams();

  const { rows, isLoading: addressLoading } = useIntegrations();
  const address = rows.whatsapp?.address;
  const { data: templates, isLoading: templatesLoading } =
    useTemplates(address);
  const deleteTemplate = useDeleteTemplate();

  // `addressLoading` must be part of this guard: while the address query is in
  // flight `useTemplates` is disabled, so its own `isLoading` is false and we
  // would fall straight through to "Template not found" on every hard refresh.
  if (addressLoading || templatesLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoaderCircle className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Inside the gate a connected number is guaranteed; this only narrows the
  // type for the editor below.
  if (!address) return null;

  const template = templates?.find((tpl) => tpl.id === templateId);

  if (!template) {
    return (
      <div className="p-4 text-muted-foreground">{t("Template not found")}</div>
    );
  }

  return (
    <>
      <SectionHeader
        title={t("Edit template")}
        onDelete={() => {
          deleteTemplate.mutate(
            { template, organizationAddress: address },
            {
              onSuccess: () =>
                navigate({ to: "..", hash: (prevHash) => prevHash! }),
            },
          );
        }}
        deleteLoading={deleteTemplate.isPending}
      />
      <TemplateEditor
        existingTemplate={template}
        organizationAddress={address}
      />
    </>
  );
}
