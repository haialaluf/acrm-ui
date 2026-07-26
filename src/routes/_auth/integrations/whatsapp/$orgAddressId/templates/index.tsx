import { createFileRoute, useNavigate } from "@tanstack/react-router";
import SectionHeader from "@/components/SectionHeader";
import TemplatesList from "@/components/templates/TemplatesList";
import { useTranslation } from "@/hooks/useTranslation";
import { useTemplates } from "@/queries/useTemplates";

export const Route = createFileRoute(
  "/_auth/integrations/whatsapp/$orgAddressId/templates/",
)({
  component: TemplatesIndex,
});

function TemplatesIndex() {
  const { translate: t } = useTranslation();
  const navigate = useNavigate();
  const { orgAddressId } = Route.useParams();

  const { data: templates, isLoading } = useTemplates(orgAddressId);

  return (
    <>
      <SectionHeader title={t("Templates")} />
      <TemplatesList
        templates={templates}
        isLoading={isLoading}
        onCreate={() =>
          navigate({
            to: "/integrations/whatsapp/$orgAddressId/templates/new",
            params: { orgAddressId },
            hash: (prevHash) => prevHash!,
          })
        }
        onSelect={(template) =>
          navigate({
            to: "/integrations/whatsapp/$orgAddressId/templates/$templateId",
            params: { orgAddressId, templateId: template.id },
            hash: (prevHash) => prevHash!,
          })
        }
      />
    </>
  );
}
