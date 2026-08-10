import { useCallback, useEffect, useState } from "react";
import { Image } from "antd";
import { type MessageRow, type Template } from "@/supabase/client";
import { TextMessage } from "./Message";
import { useTemplates } from "@/queries/useTemplates";
import { useTranslation } from "@/hooks/useTranslation";
import { useSignedMediaUrl } from "@/hooks/useSignedMediaUrl";
import {
  buttonDefToPreview,
  type PreviewButton,
} from "@/components/templateButtons";
import {
  extension,
  iconName,
  whatsappImageSize,
  LANDSCAPE_WIDTH,
  MAX_LANDSCAPE_HEIGHT,
} from "./media";
import {
  mediaBasename,
  templateHeaderMedia,
  type TemplateHeaderMedia,
} from "./templateHeaderMedia";

/* Derive preview buttons straight from the send payload. The payload only
   carries runtime values (quick-reply payload, resolved URL, coupon code) and
   not the button labels, so this is the fallback used when the template
   definition can't be found (e.g. it was deleted or hasn't loaded yet). */
function buttonsFromPayload(
  template: Template,
  copyLabel: string,
): PreviewButton[] {
  const buttons: PreviewButton[] = [];

  for (const component of template.components || []) {
    if (component.type !== "button") continue;

    switch (component.sub_type) {
      case "quick_reply":
        buttons.push({
          kind: "QR",
          text: component.parameters[0]?.payload || "",
        });
        break;
      case "url":
        buttons.push({
          kind: "URL",
          text: component.parameters[0]?.text || "",
        });
        break;
      case "copy_code":
        buttons.push({ kind: "COPY", text: copyLabel });
        break;
    }
  }

  return buttons;
}

/* The image/video/document sitting on top of a media-header template, styled
   like the chat's own media bubbles. It reports its display width so the body
   text underneath wraps to the same box, the way the real client lays it out.
   The stored link is re-signed before use — see `useSignedMediaUrl`. */
function HeaderMedia({
  media,
  onWidth,
}: {
  media: TemplateHeaderMedia;
  onWidth: (width: number) => void;
}) {
  const { translate: t } = useTranslation();
  const url = useSignedMediaUrl(media.link);
  const [box, setBox] = useState({
    width: LANDSCAPE_WIDTH,
    height: MAX_LANDSCAPE_HEIGHT,
  });

  // Shape the box to the file's own ratio (portrait narrower and taller,
  // landscape wider and shorter) once its natural size is known. Until then the
  // box keeps the default landscape frame, which would crop a portrait photo.
  const applySize = useCallback(
    (naturalWidth: number, naturalHeight: number) => {
      if (!naturalWidth || !naturalHeight) return;
      const size = whatsappImageSize(naturalWidth, naturalHeight);
      setBox(size);
      onWidth(size.width);
    },
    [onWidth],
  );

  // antd's <Image> replaces a caller-supplied `onLoad` with its own internal
  // one, so the natural size has to be read from a detached loader. The visible
  // image is served from cache, so this costs no second request.
  useEffect(() => {
    if (!url || media.format !== "IMAGE") return;
    const probe = new window.Image();
    probe.onload = () => applySize(probe.naturalWidth, probe.naturalHeight);
    probe.src = url;
    return () => {
      probe.onload = null;
    };
  }, [url, media.format, applySize]);

  if (media.format === "DOCUMENT") {
    const name = media.filename || mediaBasename(media.link) || t("Document");
    const ext = extension(name);
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="mb-[3px] py-[13px] px-[19px] rounded-md flex items-center bg-black/5 dark:bg-white/5 text-foreground"
        style={{ width: LANDSCAPE_WIDTH }}
      >
        <img src={iconName(name)} width={26} height={30} />
        <div className="mx-[10px] grow min-w-0">
          <div className="truncate">{name}</div>
          {ext && (
            <div className="text-muted-foreground py-[3px] text-[12px] uppercase">
              {ext}
            </div>
          )}
        </div>
        <svg className="w-[34px] h-[34px] text-gray-light shrink-0">
          <use href="/icons.svg#download" />
        </svg>
      </a>
    );
  }

  return (
    <div
      className="rounded-md overflow-hidden relative bg-black/5 dark:bg-white/5"
      style={{ ...box }}
    >
      {url && media.format === "IMAGE" && (
        <Image
          src={url}
          alt=""
          className="rounded-md object-cover"
          width={box.width}
          height={box.height}
        />
      )}
      {/* The native player owns the whole frame, controls included — the same
          treatment VideoMessage gives an ordinary video bubble. */}
      {url && media.format === "VIDEO" && (
        <video
          src={url}
          controls
          playsInline
          className="absolute inset-0 h-full w-full rounded-md bg-black object-cover"
          onLoadedMetadata={(e) =>
            applySize(e.currentTarget.videoWidth, e.currentTarget.videoHeight)
          }
        />
      )}
    </div>
  );
}

/* Renders an outgoing WhatsApp template message: the header media (when the
   template has one), the rendered body text (already stored in `content.text`)
   and its buttons. The stored `content.data` is the Meta send payload, which
   lacks button labels, so we look up the template definition by name to recover
   them. */
export default function TemplateMessage({
  message,
  header,
  fixedWidth,
}: {
  message: MessageRow;
  header?: string;
  fixedWidth?: boolean;
}) {
  const { translate: t } = useTranslation();
  const { data: templates } = useTemplates(
    message.organization_address ?? undefined,
  );
  // A media header hugs its own display width, and the body text wraps to match.
  const [mediaWidth, setMediaWidth] = useState<number | null>(null);

  if (message.content.type !== "data" || message.content.kind !== "template") {
    return null;
  }

  const data = message.content.data;

  // Email sends share `kind: "template"` with WhatsApp (it is what lets one set
  // of broadcast queries cover both channels), so this component now sees both
  // shapes. There is nothing WhatsApp-specific to draw for an email — no
  // quick-reply buttons, no media header — and `content.text` already holds the
  // rendered subject, so the plain text bubble below is the right rendering.
  if ("email_template_id" in data) {
    return (
      <TextMessage
        header={header}
        body={message.content.text || ""}
        type="markdown"
        direction={message.direction}
        timestamp={message.timestamp}
        status={message.direction === "outgoing" ? message.status : undefined}
        fixedWidth={fixedWidth}
      />
    );
  }

  const template = data;
  const copyLabel = t("Copy code");

  // Prefer the definition's buttons (they carry the real labels); fall back to
  // whatever the send payload encodes.
  const def = templates?.find((tpl) => tpl.name === template.name);
  const buttonsDef = def?.components.find((c) => c.type === "BUTTONS");

  const buttons: PreviewButton[] = buttonsDef
    ? buttonsDef.buttons.map((b) => buttonDefToPreview(b, copyLabel))
    : buttonsFromPayload(template, copyLabel);

  // The media header carries no text, so it is absent from `content.text` — it
  // has to be recovered from the payload the message was sent with.
  const media = templateHeaderMedia(template);

  // Hug the media box so the body wraps to the same width, starting from the
  // default frame so the bubble does not resize twice once the file's real
  // ratio is known. Text-only templates keep the ordinary bubble width.
  const width = media ? (mediaWidth ?? LANDSCAPE_WIDTH) : undefined;

  return (
    <div style={width ? { width } : undefined}>
      {media && <HeaderMedia media={media} onWidth={setMediaWidth} />}
      <TextMessage
        header={header}
        body={message.content.text || ""}
        buttons={buttons}
        type="markdown"
        direction={message.direction}
        timestamp={message.timestamp}
        status={message.direction === "outgoing" ? message.status : undefined}
        fixedWidth={fixedWidth}
      />
    </div>
  );
}
