import { Link } from "@tanstack/react-router";
import { Unplug } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useCurrentOrganization } from "@/queries/useOrganizations";

export default function NoIntegrationNotice({
  invitationLink,
  integrationsLink,
}: {
  invitationLink?: boolean;
  integrationsLink?: boolean;
}) {
  const { translate: t } = useTranslation();
  const { data: org } = useCurrentOrganization();

  return (
    <div className="flex gap-[12px] rounded-lg bg-primary/10 p-[12px] text-[14px] text-foreground">
      <Unplug className="w-[24px] h-[24px] shrink-0 text-primary" />
      <div className="flex flex-col gap-[6px]">
        <p className="font-bold">{t("Connect your first integration")}</p>
        <p>
          {t(
            "{{1}} isn't connected to any platform yet. Connect a channel or a lead source to start receiving messages and leads - the rest of the app opens up as soon as one is connected.",
          ).replace("{{1}}", org?.name || t("Your organization"))}
        </p>
        {integrationsLink && (
          <Link
            to="/integrations"
            className="font-bold text-primary/90 hover:text-primary"
          >
            {t("Go to integrations")}
          </Link>
        )}
        {invitationLink && (
          <>
            <p className="text-muted-foreground">
              {t("You've also been invited to join another organization.")}
            </p>
            <Link
              to="/conversations"
              className="font-bold text-primary/90 hover:text-primary"
            >
              {t("View invitation")}
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
