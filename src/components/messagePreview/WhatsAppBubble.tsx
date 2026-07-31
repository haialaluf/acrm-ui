import { useState } from "react";
import ReadMoreText from "./ReadMoreText";
import MediaHeader from "./MediaHeader";
import BubbleButtons from "./BubbleButtons";
import { renderInline } from "./renderWhatsAppText";
import type { MessagePreviewData } from "./types";

/** A single outgoing WhatsApp bubble — media header, header text, body,
    footer, timestamp and attached buttons. Bubble width/wrapping mirror the
    real client (max-width + word-break), so length looks true-to-life. */
export default function WhatsAppBubble({
  data,
  time,
  showIcons = true,
}: {
  data: MessagePreviewData;
  time: string;
  showIcons?: boolean;
}) {
  const hasText = data.headerType === "TEXT" && !!data.headerText;
  const hasMedia =
    data.headerType === "IMAGE" ||
    data.headerType === "VIDEO" ||
    data.headerType === "DOCUMENT";

  // An image header reports its display width so the bubble shrinks to hug it
  // and the caption wraps underneath, exactly like the real client.
  const [mediaWidth, setMediaWidth] = useState<number | null>(null);

  return (
    <div className="wa-msg">
      {/* Tail sits outside the bubble so the bubble's overflow clip can't eat it. */}
      <span className="wa-tail" />
      <div
        className={"wa-bubble" + (hasMedia ? " has-media" : "")}
        style={mediaWidth ? { width: mediaWidth } : undefined}
      >
        {hasMedia &&
          (data.headerType === "DOCUMENT" ? (
            // Documents carry their own inset; image/video get the 3px frame.
            <MediaHeader
              type={data.headerType}
              url={data.mediaUrl}
              fileName={data.mediaName}
            />
          ) : (
            <div className="wa-media-frame">
              <MediaHeader
                type={data.headerType}
                url={data.mediaUrl}
                fileName={data.mediaName}
                onSize={setMediaWidth}
              />
            </div>
          ))}
        <div className="wa-bubble-pad">
          {hasText && (
            <div className="wa-htext" dir="auto">
              {renderInline(data.headerText, data.headerVars)}
            </div>
          )}
          {data.body && <ReadMoreText text={data.body} vars={data.bodyVars} />}
          {data.footer && (
            <div className="wa-footer" dir="auto">
              {data.footer}
            </div>
          )}
          <div className="wa-time">{time}</div>
        </div>
        <BubbleButtons buttons={data.buttons} showIcons={showIcons} />
      </div>
    </div>
  );
}
