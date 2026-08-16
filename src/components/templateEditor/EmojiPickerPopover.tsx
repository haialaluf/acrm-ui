import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Popover } from "antd";
import EmojiPicker, {
  EmojiStyle,
  Theme,
  type EmojiClickData,
} from "emoji-picker-react";

/** Below this the picker becomes a sheet; the app's usual mobile breakpoint. */
const DESKTOP = "(min-width: 768px)";

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(
    () => window.matchMedia(DESKTOP).matches,
  );

  useEffect(() => {
    const query = window.matchMedia(DESKTOP);
    const update = () => setIsDesktop(query.matches);

    query.addEventListener("change", update);

    return () => query.removeEventListener("change", update);
  }, []);

  return isDesktop;
}

/**
 * Emoji picker in a popover. Uses the Apple emoji set — the closest match to
 * WhatsApp's own emoji — and inserts the real Unicode character.
 *
 * On a phone it is a bottom sheet instead, the way WhatsApp opens one. A 320px
 * panel anchored to a button has nowhere to sit on a narrow screen: whichever
 * edge it is pinned to, it runs past the other one, and the popover's
 * `overflow: hidden` renders that overflow as a grid with its columns sliced
 * off rather than a narrower grid. The sheet spans the full width, so there is
 * no anchor to overflow from. It is portaled to `document.body` so no scroll
 * container can clip it and — since a `transform` makes an ancestor the
 * containing block for `position: fixed`, and the chat list transforms every
 * row — so that `fixed` means the viewport here.
 */
export default function EmojiPickerPopover({
  onPick,
  dark,
  children,
}: {
  onPick: (emoji: string) => void;
  dark?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const isDesktop = useIsDesktop();

  const picker = (width: string, height: string) => (
    <EmojiPicker
      emojiStyle={EmojiStyle.APPLE}
      theme={dark ? Theme.DARK : Theme.LIGHT}
      lazyLoadEmojis
      width={width}
      height={height}
      previewConfig={{ showPreview: false }}
      onEmojiClick={(e: EmojiClickData) => {
        onPick(e.emoji);
        setOpen(false);
      }}
    />
  );

  if (isDesktop) {
    return (
      <Popover
        open={open}
        onOpenChange={setOpen}
        trigger="click"
        placement="topLeft"
        rootClassName="emoji-popover"
        content={picker("320px", "380px")}
      >
        {children}
      </Popover>
    );
  }

  return (
    <>
      {/* `contents` so wrapping the trigger changes nothing about its layout. */}
      <span className="contents" onClick={() => setOpen(true)}>
        {children}
      </span>

      {open &&
        createPortal(
          /* Keeps the `emoji-popover` class: ReactionPicker's outside-tap
             listener looks for it to tell "tapped inside the picker" from
             "tapped away", and the sheet is not inside its subtree. */
          <div className="emoji-popover fixed inset-0 z-[1100] flex flex-col justify-end">
            <div
              className="absolute inset-0 bg-black/40"
              onClick={() => setOpen(false)}
            />
            <div className="relative w-full overflow-hidden rounded-t-2xl shadow-2xl">
              {picker("100%", "min(50dvh, 380px)")}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
