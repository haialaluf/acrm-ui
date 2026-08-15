import { useEffect, useRef } from "react";
import { Plus } from "lucide-react";
import { Tooltip } from "antd";
import EmojiPickerPopover from "@/components/templateEditor/EmojiPickerPopover";
import { useTranslation } from "@/hooks/useTranslation";
import { QUICK_REACTIONS } from "@/utils/reactions";

/**
 * The bar of quick reactions revealed on a bubble, plus a "+" opening the full
 * picker.
 *
 * Absolutely positioned on purpose: the chat list virtualizer measures every
 * row, so a bar that took up flow would resize the row on hover and shove the
 * conversation around under the cursor.
 */
export default function ReactionPicker({
  align,
  current,
  onPick,
  disabledReason,
  open,
  onOpenChange,
}: {
  align: "start" | "end";
  /** The organization's current emoji, highlighted so a re-pick reads as toggle-off. */
  current?: string;
  onPick: (emoji: string) => void;
  /** When set, the bar is inert and explains itself instead. */
  disabledReason?: string;
  /** Held open by a long press; hover alone does not need this. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const { translate: t } = useTranslation();

  const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;

  /* Dismissing a pinned bar. A backdrop element cannot do this job here: the
     chat list positions every row with a `transform`, which makes it the
     containing block for `position: fixed`, so a "full screen" overlay would
     only ever cover its own row. A document listener is unaffected by that.
     The emoji popover portals out of this subtree, so it is matched by class. */
  const wrapper = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const dismiss = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;

      if (
        wrapper.current?.contains(target) ||
        target?.closest(".emoji-popover")
      ) {
        return;
      }

      onOpenChange?.(false);
    };

    document.addEventListener("pointerdown", dismiss);

    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open, onOpenChange]);

  const bar = (
    <div
      className={
        "flex items-center gap-[2px] rounded-full bg-background border border-border shadow-md px-[6px] py-[3px]" +
        (disabledReason ? " opacity-50" : "")
      }
    >
      {QUICK_REACTIONS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          disabled={!!disabledReason}
          title={emoji}
          className={
            "text-[18px] leading-[22px] w-[26px] h-[26px] rounded-full" +
            (disabledReason
              ? " cursor-default"
              : " cursor-pointer hover:bg-accent") +
            (current === emoji ? " bg-accent" : "")
          }
          onClick={() => {
            onPick(emoji);
            onOpenChange?.(false);
          }}
        >
          {emoji}
        </button>
      ))}

      {disabledReason ? (
        <button
          type="button"
          disabled
          className="w-[26px] h-[26px] rounded-full flex items-center justify-center cursor-default"
        >
          <Plus size={16} />
        </button>
      ) : (
        <EmojiPickerPopover
          dark={dark}
          onPick={(emoji) => {
            onPick(emoji);
            onOpenChange?.(false);
          }}
        >
          <button
            type="button"
            title={t("More emoji")}
            className="w-[26px] h-[26px] rounded-full flex items-center justify-center cursor-pointer hover:bg-accent"
          >
            <Plus size={16} />
          </button>
        </EmojiPickerPopover>
      )}
    </div>
  );

  return (
    <div
      ref={wrapper}
      className={
        "absolute -top-[18px] z-[2] transition-opacity " +
        (align === "end" ? "end-[8px] " : "start-[8px] ") +
        // Hover reveals it on pointer devices; a long press pins it on touch.
        (open
          ? "opacity-100 pointer-events-auto"
          : "opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto")
      }
    >
      {disabledReason ? <Tooltip title={disabledReason}>{bar}</Tooltip> : bar}
    </div>
  );
}
