import SectionBody from "@/components/SectionBody";
import SectionHeader from "@/components/SectionHeader";
import SectionItem from "@/components/SectionItem";
import { useTranslation } from "@/hooks/useTranslation";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Building2,
  Users,
  Webhook,
  Key,
  Bot,
  Unplug,
  Workflow,
  FileText,
} from "lucide-react";
import HideIfNotPermitted from "@/components/HideIfNotPermitted";
import { useOnboarding } from "@/hooks/useOnboarding";
import { useWorkspace } from "@/hooks/useWorkspace";

export const Route = createFileRoute("/_auth/settings/")({
  component: SettingsIndex,
});

function SettingsIndex() {
  const { translate: t } = useTranslation();
  const { isTherapy } = useWorkspace();
  const navigate = useNavigate();
  const { showsEverything } = useOnboarding();

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
          {isTherapy && (
            <SectionItem
              title={t("Report templates")}
              aside={
                <div className="p-[8px]">
                  <FileText className="w-[24px] h-[24px] text-muted-foreground" />
                </div>
              }
              onClick={() =>
                navigate({
                  to: "/settings/report-templates",
                  hash: (prevHash) => prevHash!,
                })
              }
            />
          )}
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
          {showsEverything && (
            <SectionItem
              title={t("Agents")}
              aside={
                <div className="p-[8px]">
                  <Bot className="w-[24px] h-[24px] text-muted-foreground" />
                </div>
              }
              onClick={() =>
                navigate({ to: "/agents", hash: (prevHash) => prevHash! })
              }
            />
          )}
          {showsEverything && (
            <HideIfNotPermitted surface="/automations">
              <SectionItem
                title={t("Automations")}
                aside={
                  <div className="p-[8px]">
                    <Workflow className="w-[24px] h-[24px] text-muted-foreground" />
                  </div>
                }
                onClick={() =>
                  navigate({
                    to: "/automations",
                    hash: (prevHash) => prevHash!,
                  })
                }
              />
            </HideIfNotPermitted>
          )}
          <SectionItem
            title={t("Integrations")}
            aside={
              <div className="p-[8px]">
                <Unplug className="w-[24px] h-[24px] text-muted-foreground" />
              </div>
            }
            onClick={() =>
              navigate({ to: "/integrations", hash: (prevHash) => prevHash! })
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
          <SectionItem
            title={t("Connect Claude")}
            aside={
              <div className="p-[8px]">
                <Bot className="w-[24px] h-[24px] text-muted-foreground" />
              </div>
            }
            onClick={() =>
              navigate({
                to: "/settings/connect-claude",
                hash: (prevHash) => prevHash!,
              })
            }
          />
          <SectionItem
            title={t("Connect ChatGPT")}
            aside={
              <div className="p-[8px]">
                <Bot className="w-[24px] h-[24px] text-muted-foreground" />
              </div>
            }
            onClick={() =>
              navigate({
                to: "/settings/connect-chatgpt",
                hash: (prevHash) => prevHash!,
              })
            }
          />
        </div>
      </SectionBody>
    </>
  );
}
