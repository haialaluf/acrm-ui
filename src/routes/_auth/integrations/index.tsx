import SectionBody from "@/components/SectionBody";
import SectionHeader from "@/components/SectionHeader";
import SectionItem from "@/components/SectionItem";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { FileText, Mail, Webhook } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import {
  FacebookFilled,
  InstagramOutlined,
  WhatsAppOutlined,
} from "@ant-design/icons";

export const Route = createFileRoute("/_auth/integrations/")({
  component: IntegrationsIndex,
});

function IntegrationsIndex() {
  const { translate: t } = useTranslation();
  const navigate = useNavigate();

  return (
    <>
      <SectionHeader title={t("Integrations")} />
      <SectionBody className="gap-4">
        <div className="flex flex-col">
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
                <FacebookFilled
                  style={{ fontSize: "24px", color: "#1877F2" }}
                />
              </div>
            }
            title={t("Facebook Leads")}
            description={t("Instant Form leads become contacts automatically")}
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
                <Mail className="w-[24px] h-[24px] text-muted-foreground" />
              </div>
            }
            title={t("Email")}
            description={t("Send from your own domain")}
            onClick={() =>
              navigate({
                to: "/integrations/email",
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
            onClick={() =>
              navigate({
                to: "/integrations/api",
                hash: (prevHash) => prevHash!,
              })
            }
          />
          <SectionItem
            aside={
              <div className="p-[8px]">
                <FileText className="w-[24px] h-[24px]" />
              </div>
            }
            title={t("Media pre-processing")}
            description={t("Interprets audio, images, and documents")}
            onClick={() =>
              navigate({
                to: "/integrations/media-preprocessing",
                hash: (prevHash) => prevHash!,
              })
            }
          />
        </div>
      </SectionBody>
    </>
  );
}
