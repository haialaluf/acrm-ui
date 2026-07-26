import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LoaderCircle } from "lucide-react";
import SectionHeader from "@/components/SectionHeader";
import TemplateEditor from "@/components/TemplateEditor";
import { NoWhatsAppState } from "@/components/templates/TemplatesList";
import { useTranslation } from "@/hooks/useTranslation";
import { useConnectedWhatsAppAddress } from "@/hooks/useConnectedWhatsAppAddress";
import { useTemplates, useDeleteTemplate } from "@/queries/useTemplates";

export const Route = createFileRoute("/_auth/templates/$templateId")({
  component: EditTemplate,
});

function EditTemplate() {
  const { translate: t } = useTranslation();
  const navigate = useNavigate();
  const { templateId } = Route.useParams();

  const { address, isLoading: addressLoading } = useConnectedWhatsAppAddress();
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

  if (!address) {
    return (
      <>
        <SectionHeader title={t("Edit template")} />
        <NoWhatsAppState />
      </>
    );
  }

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
