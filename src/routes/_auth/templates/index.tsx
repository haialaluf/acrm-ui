import { createFileRoute, useNavigate } from "@tanstack/react-router";
import SectionHeader from "@/components/SectionHeader";
import TemplatesList, {
  NoWhatsAppState,
} from "@/components/templates/TemplatesList";
import { useTranslation } from "@/hooks/useTranslation";
import { useConnectedWhatsAppAddress } from "@/hooks/useConnectedWhatsAppAddress";
import { useTemplates } from "@/queries/useTemplates";

export const Route = createFileRoute("/_auth/templates/")({
  component: TemplatesIndex,
});

function TemplatesIndex() {
  const { translate: t } = useTranslation();
  const navigate = useNavigate();

  const { address, isLoading: addressLoading } = useConnectedWhatsAppAddress();
  const { data: templates, isLoading: templatesLoading } =
    useTemplates(address);

  return (
    <>
      <SectionHeader title={t("Templates")} />
      {!addressLoading && !address ? (
        <NoWhatsAppState />
      ) : (
        <TemplatesList
          templates={templates}
          isLoading={addressLoading || templatesLoading}
          onCreate={() =>
            navigate({ to: "/templates/new", hash: (prevHash) => prevHash! })
          }
          onSelect={(template) =>
            navigate({
              to: "/templates/$templateId",
              params: { templateId: template.id },
              hash: (prevHash) => prevHash!,
            })
          }
        />
      )}
    </>
  );
}
