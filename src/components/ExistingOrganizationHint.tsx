import CopyButton from "@/components/CopyButton";
import { useTranslation } from "@/hooks/useTranslation";
import useBoundStore from "@/stores/useBoundStore";

export default function ExistingOrganizationHint() {
  const { translate: t } = useTranslation();
  const email = useBoundStore((state) => state.ui.user?.email);

  return (
    <div className="mt-[24px] pl-[10px] flex flex-col gap-[8px] border-t border-border pt-[24px] pb-[16px] text-[14px]">
      <p className="font-bold text-foreground">
        {t("Does your organization already exist?")}
      </p>
      <p className="text-muted-foreground">
        {t(
          "Don't create another one - ask your organization's administrator to send an invitation to your email address. It will appear here as soon as it's sent.",
        )}
      </p>
      {email && (
        <div className="flex items-center justify-between gap-[8px] rounded-xl bg-muted ps-[16px] pe-[8px] py-[8px]">
          <span className="truncate text-foreground" dir="ltr">
            {email}
          </span>
          <CopyButton value={email} title={t("Copy email")} />
        </div>
      )}
    </div>
  );
}
