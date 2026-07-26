import { createFileRoute } from "@tanstack/react-router";
import { LoaderCircle } from "lucide-react";
import SectionHeader from "@/components/SectionHeader";
import TemplateEditor from "@/components/TemplateEditor";
import { NoWhatsAppState } from "@/components/templates/TemplatesList";
import { useTranslation } from "@/hooks/useTranslation";
import { useConnectedWhatsAppAddress } from "@/hooks/useConnectedWhatsAppAddress";

export const Route = createFileRoute("/_auth/templates/new")({
  component: NewTemplate,
});

function NewTemplate() {
  const { translate: t } = useTranslation();
  const { address, isLoading } = useConnectedWhatsAppAddress();

  return (
    <>
      <SectionHeader title={t("Create template")} />
      {isLoading ? (
        <div className="flex h-full items-center justify-center">
          <LoaderCircle className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : !address ? (
        <NoWhatsAppState />
      ) : (
        <TemplateEditor organizationAddress={address} />
      )}
    </>
  );
}
