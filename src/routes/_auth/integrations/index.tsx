import SectionBody from "@/components/SectionBody";
import SectionHeader from "@/components/SectionHeader";
import SectionItem from "@/components/SectionItem";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Mail, Webhook } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import {
  FacebookFilled,
  InstagramOutlined,
  WhatsAppOutlined,
} from "@ant-design/icons";

export const Route = createFileRoute("/_auth/integrations/")({
  component: IntegrationsIndex,
});

/**
 * Groups the list by what a row actually *is*, because the rows are not the
 * same kind of thing and the difference decides what the app unlocks:
 *
 *  - Channels carry messages, so they are what Broadcasts, Templates and
 *    Statistics need before they are worth opening.
 *  - Lead sources only create contacts. They fill Contacts and can fire an
 *    automation, but there is nothing to send on.
 *
 * Same styling as the automation insert menu's group labels.
 */
function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-[9px] pb-[5px] pt-[14px] text-[10.5px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
      {children}
    </div>
  );
}

function IntegrationsIndex() {
  const { translate: t } = useTranslation();
  const navigate = useNavigate();

  return (
    <>
      <SectionHeader title={t("Integrations")} />
      <SectionBody className="gap-4">
        <div className="flex flex-col">
          <GroupLabel>{t("Channels")}</GroupLabel>
          <SectionItem
            aside={
              <div className="p-[8px]">
                <WhatsAppOutlined
                  style={{ fontSize: "24px", color: "#25D366" }}
                />
              </div>
            }
            title="WhatsApp"
            onClick={() =>
              navigate({
                to: "/integrations/whatsapp",
                hash: (prevHash) => prevHash!,
              })
            }
          />
          <SectionItem
            aside={
              <div className="p-[8px]">
                <InstagramOutlined
                  style={{ fontSize: "24px", color: "#E1306C" }}
                />
              </div>
            }
            title="Instagram"
            onClick={() =>
              navigate({
                to: "/integrations/instagram",
                hash: (prevHash) => prevHash!,
              })
            }
          />
          <SectionItem
            aside={
              <div className="p-[8px]">
                <Mail className="w-[24px] h-[24px] text-muted-foreground" />
              </div>
            }
            title={t("Email")}
            description={t("Send from your own domain")}
            wrapDescription
            onClick={() =>
              navigate({
                to: "/integrations/email",
                hash: (prevHash) => prevHash!,
              })
            }
          />
          <GroupLabel>{t("Lead sources")}</GroupLabel>
          <SectionItem
            aside={
              <div className="p-[8px]">
                <FacebookFilled
                  style={{ fontSize: "24px", color: "#1877F2" }}
                />
              </div>
            }
            title={t("Facebook Leads")}
            description={t("Instant Form leads become contacts automatically")}
            wrapDescription
            onClick={() =>
              navigate({
                to: "/integrations/facebook",
                hash: (prevHash) => prevHash!,
              })
            }
          />
          <SectionItem
            aside={
              <div className="p-[8px]">
                <Webhook className="w-[24px] h-[24px] text-muted-foreground" />
              </div>
            }
            title={t("API Leads")}
            description={t("Post contacts to your own endpoint URL")}
            wrapDescription
            onClick={() =>
              navigate({
                to: "/integrations/api",
                hash: (prevHash) => prevHash!,
              })
            }
          />
        </div>
      </SectionBody>
    </>
  );
}
