import SectionBody from "@/components/SectionBody";
import SectionHeader from "@/components/SectionHeader";
import SectionItem from "@/components/SectionItem";
import { useTranslation } from "@/hooks/useTranslation";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Building2, Users, Webhook, Key } from "lucide-react";

export const Route = createFileRoute("/_auth/settings/")({
  component: SettingsIndex,
});

function SettingsIndex() {
  const { translate: t } = useTranslation();
  const navigate = useNavigate();

  return (
    <>
      <SectionHeader title={t("Settings")} />

      <SectionBody className="gap-4">
        <div className="flex flex-col">
          <SectionItem
            title={t("Organization")}
            aside={
              <div className="p-[8px]">
                <Building2 className="w-[24px] h-[24px] text-muted-foreground" />
              </div>
            }
            onClick={() =>
              navigate({
                to: "/settings/organization",
                hash: (prevHash) => prevHash!,
              })
            }
          />
          <SectionItem
            title={t("Members")}
            aside={
              <div className="p-[8px]">
                <Users className="w-[24px] h-[24px] text-muted-foreground" />
              </div>
            }
            onClick={() =>
              navigate({
                to: "/settings/members",
                hash: (prevHash) => prevHash!,
              })
            }
          />
          <SectionItem
            title={t("Webhooks")}
            aside={
              <div className="p-[8px]">
                <Webhook className="w-[24px] h-[24px] text-muted-foreground" />
              </div>
            }
            onClick={() =>
              navigate({
                to: "/settings/webhooks",
                hash: (prevHash) => prevHash!,
              })
            }
          />
          <SectionItem
            title={t("API Keys")}
            aside={
              <div className="p-[8px]">
                <Key className="w-[24px] h-[24px] text-muted-foreground" />
              </div>
            }
            onClick={() =>
              navigate({
                to: "/settings/api-keys",
                hash: (prevHash) => prevHash!,
              })
            }
          />
        </div>
      </SectionBody>
    </>
  );
}
