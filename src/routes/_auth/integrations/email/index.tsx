import SectionBody from "@/components/SectionBody";
import SectionHeader from "@/components/SectionHeader";
import SectionItem from "@/components/SectionItem";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useOrganizationsAddresses } from "@/queries/useOrganizationsAddresses";
import { useTranslation } from "@/hooks/useTranslation";
import { Mail, Plus } from "lucide-react";
import type { JSX } from "react";

export const Route = createFileRoute("/_auth/integrations/email/")({
  component: EmailIndex,
});

function EmailIndex() {
  const { translate: t } = useTranslation();
  const navigate = useNavigate();
  const { data: integrations } = useOrganizationsAddresses();

  const emailIntegrations = integrations?.filter(
    (integration) => integration.service === "email",
  );

  const statusLabels: Record<string, string | JSX.Element> = {
    connected: <span className="text-primary">{t("Verified")}</span>,
    pending: <span className="text-warning">{t("Pending verification")}</span>,
    failed: (
      <span className="text-destructive">{t("Verification failed")}</span>
    ),
    disconnected: t("Disconnected"),
  };

  return (
    <>
      <SectionHeader title={t("Email")} />

      <SectionBody className="gap-4">
        <div className="flex flex-col">
          <SectionItem
            title={t("Connect domain")}
            aside={
              <div className="p-[8px] bg-primary/10 rounded-full">
                <Plus className="w-[24px] h-[24px] text-primary" />
              </div>
            }
            onClick={() =>
              navigate({
                to: "/integrations/email/new",
                hash: (prevHash) => prevHash!,
              })
            }
          />
          {emailIntegrations?.map((integration) => (
            <SectionItem
              key={integration.address}
              aside={
                <div className="p-[8px]">
                  <Mail className="w-[24px] h-[24px] text-muted-foreground" />
                </div>
              }
              title={integration.address}
              description={
                statusLabels[integration.status] || integration.status
              }
              onClick={() =>
                navigate({
                  to: "/integrations/email/$orgAddressId",
                  params: { orgAddressId: integration.address },
                  hash: (prevHash) => prevHash!,
                })
              }
            />
          ))}
        </div>
      </SectionBody>
    </>
  );
}
