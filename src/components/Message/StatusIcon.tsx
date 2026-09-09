import { Tooltip } from "antd";
import { type OutgoingStatus } from "@/supabase/client";
import { useHoverCapable } from "@/hooks/useHoverCapable";
import { useTranslation } from "@/hooks/useTranslation";
import { getStatusPresentation } from "@/utils/MessageStatusUtils";
import { failureReason } from "@/utils/failureReason";

export default function StatusIcon(status: OutgoingStatus) {
  const { translate: t } = useTranslation();
  const canHover = useHoverCapable();
  const { icon, color, title } = getStatusPresentation(status);

  const mark = (
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

  // Hover-only, so touch keeps the bubble's own tap and long press. The
  // broadcast recipient list is where the same reason is readable without a
  // pointer.
  const reason = icon === "x" && canHover ? failureReason(status) : null;
  if (!reason) return mark;

  return (
    <Tooltip
      placement="top"
      trigger={["hover"]}
      styles={{ root: { maxWidth: "280px" } }}
      title={
        <span className="text-[12px] leading-snug">
          {reason.code && (
            <span dir="ltr" className="font-mono opacity-70">
              {reason.code}{" "}
            </span>
          )}
          {t(reason.title)}
          {reason.hint && (
            <span className="block mt-[3px] opacity-70">{t(reason.hint)}</span>
          )}
        </span>
      }
    >
      <span className="inline-flex cursor-help">{mark}</span>
    </Tooltip>
  );
}
