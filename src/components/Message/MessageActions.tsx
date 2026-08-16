import { Dropdown, Tooltip, type MenuProps } from "antd";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

/**
 * The chevron in a bubble's top corner and the menu it opens.
 *
 * Only "Reply" for now — the affordance is WhatsApp's, the menu is deliberately
 * a single item rather than their full Star/Pin/Forward set.
 *
 * Revealed by hover on pointer devices and pinned open by the long press
 * `BubbleColumn` already arms for touch. Absolutely positioned so it never
 * takes up flow: the chat list virtualizer measures every row, and a control
 * that grew the row on hover would shove the conversation under the cursor.
 *
 * It sits at the bubble's trailing corner on both sides of the conversation,
 * which is where WhatsApp Web puts it for incoming and outgoing alike.
 */
export default function MessageActions({
  bubbleColor,
  onReply,
  disabledReason,
  open,
  onOpenChange,
}: {
  /** Tailwind gradient stop matching the bubble it sits on. */
  bubbleColor: string;
  onReply: () => void;
  /** When set, the item is inert and explains itself instead. */
  disabledReason?: string;
  /** Held open by a long press; hover alone does not need this. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const { translate: t } = useTranslation();

  const items: MenuProps["items"] = [
    {
      key: "reply",
      label: disabledReason ? (
        <Tooltip title={disabledReason}>
          <span>{t("Reply")}</span>
        </Tooltip>
      ) : (
        t("Reply")
      ),
      disabled: !!disabledReason,
      onClick: onReply,
    },
  ];

  return (
    <div
      className={
        "absolute top-0 end-0 z-[2] transition-opacity " +
        (open
          ? "opacity-100 pointer-events-auto"
          : "opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto")
      }
    >
      <Dropdown
        menu={{ items }}
        trigger={["click"]}
        open={open}
        onOpenChange={onOpenChange}
        placement="bottomRight"
      >
        <button
          type="button"
          title={t("Message actions")}
          // The gradient fades the bubble's own colour in under the chevron, so
          // it never sits on top of the message text — what WhatsApp Web does.
          //
          // Kept to the bubble's top ~19px on purpose: a one-line bubble puts
          // its timestamp in the bottom trailing corner, directly below this,
          // and a taller button swallows it.
          className={
            "w-[30px] h-[19px] flex items-center justify-end pe-[2px] cursor-pointer rounded-tr-lg text-muted-foreground bg-gradient-to-l from-45% to-transparent " +
            bubbleColor
          }
        >
          <ChevronDown className="w-[16px] h-[16px]" />
        </button>
      </Dropdown>
    </div>
  );
}
