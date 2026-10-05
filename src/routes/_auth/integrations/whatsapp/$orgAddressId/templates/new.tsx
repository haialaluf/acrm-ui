import { createFileRoute, useNavigate } from "@tanstack/react-router";
import SectionHeader from "@/components/SectionHeader";
import { useTranslation } from "@/hooks/useTranslation";
import TemplateEditor from "@/components/TemplateEditor";
import { clearFormDraft } from "@/hooks/useFormDraft";
import { newTemplateDraftKey } from "@/components/templateEditorTypes";

export const Route = createFileRoute(
  "/_auth/integrations/whatsapp/$orgAddressId/templates/new",
)({
  component: NewTemplate,
});

function NewTemplate() {
  const { translate: t } = useTranslation();
  const navigate = useNavigate();
  const { orgAddressId } = Route.useParams();

  const discardAndGoBack = () => {
    clearFormDraft(newTemplateDraftKey(orgAddressId));
    void navigate({ to: "..", hash: (prevHash) => prevHash! });
  };

  return (
    <>
      <SectionHeader title={t("Create template")} onBack={discardAndGoBack} />
      <TemplateEditor organizationAddress={orgAddressId} persistDraft />
    </>
  );
}
