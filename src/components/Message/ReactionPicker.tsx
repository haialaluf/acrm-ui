import { useEffect, useRef } from "react";
import { Plus, SmilePlus } from "lucide-react";
import { Tooltip } from "antd";
import EmojiPickerPopover from "@/components/templateEditor/EmojiPickerPopover";
import { useTranslation } from "@/hooks/useTranslation";
import { QUICK_REACTIONS } from "@/utils/reactions";

/**
 * The reaction affordance on a bubble: a smiley button beside it, and the bar of
 * quick reactions (plus a "+" opening the full picker) that button opens.
 *
 * Hover only reveals the button — the bar itself is a click away, the way
 * WhatsApp Web does it. Revealing both at once put the bar on top of the reply
 * chevron in the bubble's corner.
 *
 * Absolutely positioned on purpose: the chat list virtualizer measures every
 * row, so controls that took up flow would resize the row on hover and shove the
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
  /** When set, only the button shows — inert, explaining itself instead. */
  disabledReason?: string;
  /** Whether the quick bar is open: by its button, or pinned by a long press. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const { translate: t } = useTranslation();

  const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;

  /* Dismissing an open bar. A backdrop element cannot do this job here: the
     chat list positions every row with a `transform`, which makes it the
     containing block for `position: fixed`, so a "full screen" overlay would
     only ever cover its own row. A document listener is unaffected by that.
     The emoji popover portals out of this subtree, so it is matched by class.

     The wrapper holds the button too, so a click on it dismisses through the
     button's own toggle rather than firing both. */
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
    <div className="flex items-center gap-[2px] rounded-full bg-background border border-border shadow-md px-[6px] py-[3px]">
      {QUICK_REACTIONS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          title={emoji}
          className={
            "text-[18px] leading-[22px] w-[26px] h-[26px] rounded-full cursor-pointer hover:bg-accent" +
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
    </div>
  );

  /* Not the `disabled` attribute: a disabled button swallows the pointer events
     the tooltip listens for, and the tooltip is the whole point of showing the
     button on a message that cannot take a reaction. */
  const button = (
    <button
      type="button"
      aria-disabled={!!disabledReason}
      title={disabledReason ? undefined : t("React")}
      className={
        "w-[26px] h-[26px] rounded-full flex items-center justify-center bg-background border border-border shadow-md text-muted-foreground" +
        (disabledReason
          ? " opacity-50 cursor-default"
          : " cursor-pointer hover:bg-accent")
      }
      onClick={() => !disabledReason && onOpenChange?.(!open)}
    >
      <SmilePlus size={15} />
    </button>
  );

  return (
    /* `contents` so the two children position against the bubble column, which
       is what `relative` in this tree refers to. */
    <div ref={wrapper} className="contents">
      <div
        className={
          // A full-height strip rather than just the button: it runs flush to
          // the bubble's edge, so moving the cursor out to the button never
          // crosses a gap that would drop `group-hover` and hide it mid-reach.
          "absolute top-0 bottom-0 flex items-center z-[2] transition-opacity " +
          // Just outside the bubble, on the side away from the reply chevron.
          (align === "end"
            ? "start-[-34px] pe-[8px] "
            : "end-[-34px] ps-[8px] ") +
          // Hover reveals it on pointer devices; a long press pins it on touch.
          (open
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto")
        }
      >
        {disabledReason ? (
          <Tooltip title={disabledReason}>
            <span className="inline-flex">{button}</span>
          </Tooltip>
        ) : (
          button
        )}
      </div>

      {open && !disabledReason && (
        <div
          className={
            "absolute -top-[18px] z-[3] " +
            (align === "end" ? "end-[8px]" : "start-[8px]")
          }
        >
          {bar}
        </div>
      )}
    </div>
  );
}
