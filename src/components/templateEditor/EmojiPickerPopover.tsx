import { useState, type ReactNode } from "react";
import { Popover } from "antd";
import EmojiPicker, {
  EmojiStyle,
  Theme,
  type EmojiClickData,
} from "emoji-picker-react";

/** Emoji picker in an antd Popover. Uses the Apple emoji set — the closest
    match to WhatsApp's own emoji — and inserts the real Unicode character. */
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

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger="click"
      placement="topLeft"
      rootClassName="emoji-popover"
      content={
        <EmojiPicker
          emojiStyle={EmojiStyle.APPLE}
          theme={dark ? Theme.DARK : Theme.LIGHT}
          lazyLoadEmojis
          width={320}
          height={380}
          previewConfig={{ showPreview: false }}
          onEmojiClick={(e: EmojiClickData) => {
            onPick(e.emoji);
            setOpen(false);
          }}
        />
      }
    >
      {children}
    </Popover>
  );
}
