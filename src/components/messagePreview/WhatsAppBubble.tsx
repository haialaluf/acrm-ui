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

  return (
    <div className="wa-msg">
      <div className={"wa-bubble" + (hasMedia ? " has-media" : "")}>
        <span className="wa-tail" />
        {hasMedia && (
          <MediaHeader
            type={data.headerType}
            url={data.mediaUrl}
            fileName={data.mediaName}
          />
        )}
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
