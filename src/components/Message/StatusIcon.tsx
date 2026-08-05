import { type OutgoingStatus } from "@/supabase/client";
import { useTranslation } from "@/hooks/useTranslation";
import { getStatusPresentation } from "@/utils/MessageStatusUtils";

export default function StatusIcon(status: OutgoingStatus) {
  const { translate: t } = useTranslation();
  const { icon, color, title } = getStatusPresentation(status);

  return (
    <svg
      className={
        `w-[16px] ml-[3px] ${color}` +
        (icon === "clock" ? " h-[15px]" : " h-[11px]")
      }
    >
      {title && <title>{t(title)}</title>}
      <use href={`/icons.svg#msg-${icon}`} />
    </svg>
  );
}
