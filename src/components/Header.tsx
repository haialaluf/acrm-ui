import { useTranslation } from "@/hooks/useTranslation";
import { LinkButton } from "@/components/LinkButton";
import { useCurrentOrganization } from "@/queries/useOrganizations";
import { MessageSquarePlus, Send } from "lucide-react";

export default function Header() {
  const { data: org } = useCurrentOrganization();

  const { translate: t } = useTranslation();

  return (
    <div className="header flex justify-between w-full">
      <div className="flex items-center truncate">
        <div className="text-primary tracking-tighter font-bold text-[24px]">
          {org?.name || "OpenBSP"}
        </div>
      </div>
      <div className="flex justify-end items-center">
        <LinkButton
          to="/conversations/bulk-send"
          className="ml-[4px]"
          title={t("Envío masivo")}
        >
          <Send className="w-[22px] h-[22px] text-foreground" />
        </LinkButton>
        <LinkButton
          to="/conversations/new"
          className="ml-[10px]"
          title={t("Nueva conversación")}
        >
          <MessageSquarePlus className="w-[24px] h-[24px] text-foreground" />
        </LinkButton>
      </div>
    </div>
  );
}
