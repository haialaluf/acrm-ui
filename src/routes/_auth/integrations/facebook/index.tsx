import SectionBody from "@/components/SectionBody";
import SectionHeader from "@/components/SectionHeader";
import SectionItem from "@/components/SectionItem";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useOrganizationsAddresses } from "@/queries/useOrganizationsAddresses";
import { useTranslation } from "@/hooks/useTranslation";
import { FacebookFilled } from "@ant-design/icons";
import { Link, Plus } from "lucide-react";
import type { JSX } from "react";
import type { FacebookOrganizationAddressExtra } from "@/supabase/client";

export const Route = createFileRoute("/_auth/integrations/facebook/")({
  component: FacebookIndex,
});

function FacebookIndex() {
  const { translate: t } = useTranslation();
  const navigate = useNavigate();
  const { data: integrations } = useOrganizationsAddresses();

  const facebookIntegrations = integrations?.filter(
    (integration) => integration.service === "facebook",
  );

  const statusLabels: Record<string, string | JSX.Element> = {
    connected: <span className="text-primary">{t("Connected")}</span>,
    disconnected: t("Disconnected"),
  };

  return (
    <>
      <SectionHeader title={t("Facebook Leads")} />

      <SectionBody className="gap-4">
        <div className="flex flex-col">
          <SectionItem
            title={t("Connect Page")}
            aside={
              <div className="p-[8px] bg-primary/10 rounded-full">
                <Plus className="w-[24px] h-[24px] text-primary" />
              </div>
            }
            onClick={() =>
              navigate({
                to: "/integrations/facebook/new",
                hash: (prevHash) => prevHash!,
              })
            }
          />
          <SectionItem
            title={t("Third-party invitations")}
            aside={
              <div className="p-[8px]">
                <Link className="w-[24px] h-[24px] text-muted-foreground" />
              </div>
            }
            onClick={() =>
              navigate({
                to: "/integrations/facebook/onboarding",
                hash: (prevHash) => prevHash!,
              })
            }
          />
          {facebookIntegrations?.map((integration) => {
            const extra =
              integration.extra as FacebookOrganizationAddressExtra | null;
            const title = extra?.page_name || integration.address;
            return (
              <SectionItem
                key={integration.address}
                aside={
                  <div className="p-[8px]">
                    <FacebookFilled
                      style={{ fontSize: "24px", color: "#1877F2" }}
                    />
                  </div>
                }
                title={title}
                description={
                  statusLabels[integration.status] || integration.status
                }
                onClick={() =>
                  navigate({
                    to: "/integrations/facebook/$orgAddressId",
                    params: { orgAddressId: integration.address },
                    hash: (prevHash) => prevHash!,
                  })
                }
              />
            );
          })}
        </div>
      </SectionBody>
    </>
  );
}
