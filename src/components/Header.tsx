import { useTranslation } from "@/hooks/useTranslation";
import { LinkButton } from "@/components/LinkButton";
import { useCurrentOrganization } from "@/queries/useOrganizations";
import HideIfNotPermitted from "@/components/HideIfNotPermitted";
import { MessageSquarePlus } from "lucide-react";

export default function Header() {
  const { data: org } = useCurrentOrganization();

  const { translate: t } = useTranslation();

  return (
    <div className="header flex justify-between w-full">
      <div className="flex items-center truncate">
        <div className="text-primary tracking-tighter font-bold text-[24px]">
          {org?.name || "DelaCRM"}
        </div>
      </div>
      <div className="flex justify-end items-center">
        <HideIfNotPermitted surface="header.newConversation">
          <LinkButton
            to="/conversations/bulk-send"
            className="ms-[10px] flex items-center gap-[8px]"
            title={t("New conversation")}
          >
            <MessageSquarePlus className="w-[24px] h-[24px] text-foreground shrink-0" />
            <span className="text-[14px] text-foreground truncate">
              {t("New conversation")}
            </span>
          </LinkButton>
        </HideIfNotPermitted>
      </div>
    </div>
  );
}
