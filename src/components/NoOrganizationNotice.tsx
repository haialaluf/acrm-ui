import { Building2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "@/hooks/useTranslation";
import { NEW_ORGANIZATION_PATH } from "@/hooks/useOnboarding";

export default function NoOrganizationNotice({
  hasInvitations,
}: {
  hasInvitations: boolean;
}) {
  const { translate: t } = useTranslation();

  return (
    <div className="flex gap-[12px] rounded-lg bg-primary/10 p-[12px] text-[14px] text-foreground">
      <Building2 className="w-[24px] h-[24px] shrink-0 text-primary" />
      <div className="flex flex-col gap-[6px]">
        <p className="font-bold">
          {t("You're not part of any organization yet")}
        </p>
        {hasInvitations ? (
          <>
            <p>
              {t(
                "You've been invited to join an organization. Accept the invitation to get started.",
              )}
            </p>
            <Link
              to={NEW_ORGANIZATION_PATH}
              className="font-bold text-primary/90 hover:text-primary"
            >
              {t("Or create a new organization")}
            </Link>
          </>
        ) : (
          <p>{t("Create a new organization to get started.")}</p>
        )}
      </div>
    </div>
  );
}
