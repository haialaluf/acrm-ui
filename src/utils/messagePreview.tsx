import { type ReactNode } from "react";
import { type MessageRow } from "@/supabase/client";
import { getHighestStatus } from "@/utils/MessageStatusUtils";
import { mediaCategory } from "@/components/Message/media";

/**
 * One message boiled down to a single line — the sidebar's last-message row and
 * the quoted block above a reply both draw it, so they can never drift apart.
 */

export function mediaPreview(
  t: (content: string) => ReactNode,
  message?: MessageRow,
) {
  let mediaIcon = null;
  let mediaIconClass = "mr-[3px]";
  let mediaPreviewContent: ReactNode = "";

  if (
    !message ||
    !(message.direction === "incoming" || message.direction === "outgoing")
  ) {
    return { mediaIcon, mediaPreviewContent };
  }

  // Media that could not be ingested arrives as an empty data placeholder.
  // Show a media icon and a friendly label instead of an empty "{}".
  if (
    message.content.type === "data" &&
    message.content.kind === "media_placeholder"
  ) {
    mediaIcon = (
      <div>
        <svg className={`${mediaIconClass} h-[20px] w-[16px]`}>
          <use href="/icons.svg#chat-image" />
        </svg>
      </div>
    );
    mediaPreviewContent = t("Unavailable media");
    return { mediaIcon, mediaPreviewContent };
  }

  if (message.content.type !== "file") {
    return { mediaIcon, mediaPreviewContent };
  }

  const type = message.content.kind;
  const status = getHighestStatus(message.status);

  const mime = message.content.file?.mime_type || "";

  // Known kinds keep their own icon (incl. the distinct sticker icon); the
  // Instagram "native" kinds and the generic file/media kinds resolve via the
  // shared kind/MIME mapping (e.g. a shared reel gets the video icon).
  const knownKinds = ["audio", "document", "image", "sticker", "video"];
  const iconKind = knownKinds.includes(type) ? type : mediaCategory(type, mime);

  // Instagram "native" share kinds get friendlier last-message labels.
  const igLabels: Record<string, ReactNode> = {
    ig_post: t("Post"),
    ig_reel: t("Reel"),
    reel: t("Reel"),
    story: t("Story"),
    ig_story: t("Story"),
    story_mention: t("Story mention"),
    story_reply: t("Story reply"),
  };

  switch (iconKind) {
    case "audio":
      mediaIconClass += " h-[20px] w-[12px]";

      if (status === "read") {
        mediaIconClass += " text-primary";
      }

      // TODO: Should be the audio length - cabra 24/05/2024
      mediaPreviewContent = t("Audio");
      break;
    case "document":
      mediaIconClass += " h-[20px] w-[13px]";
      mediaPreviewContent = message.content.file?.name || t("Document");
      break;
    case "image":
      mediaIconClass += " h-[20px] w-[16px]";
      mediaPreviewContent = t("Photo");
      break;
    case "sticker":
      mediaIconClass += " h-[16px] w-[16px] mt-[4px]";
      mediaPreviewContent = t("Sticker");
      break;
    case "video":
      mediaIconClass += " h-[20px] w-[16px]";
      mediaPreviewContent = message.content.file?.name || t("Video");
      break;
  }

  // Override the label for Instagram shares (icon stays image/video).
  if (igLabels[type]) {
    mediaPreviewContent = igLabels[type];
  }

  mediaIcon = (
    <div>
      <svg className={mediaIconClass}>
        <use href={`/icons.svg#chat-${iconKind}`} />
      </svg>
    </div>
  );

  return { mediaIcon, mediaPreviewContent };
}

/**
 * The text half of the same line: what the message says, or the label its media
 * stands in for. Pair it with `mediaPreview`'s icon.
 */
export function messagePreviewText(
  message: MessageRow,
  mediaPreviewContent: ReactNode,
): ReactNode {
  if (message.content.type === "text") return message.content.text;

  if (message.content.type === "data") {
    // A data part that was rendered for display (a template, for one) carries
    // the flattened text the recipient sees — show that rather than the raw
    // payload. The JSON stays as the fallback for parts with nothing
    // human-readable.
    if (message.content.kind === "media_placeholder")
      return mediaPreviewContent;

    return message.content.text || JSON.stringify(message.content.data);
  }

  return mediaPreviewContent;
}
