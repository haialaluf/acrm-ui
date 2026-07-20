import { useState } from "react";
import dayjs from "dayjs";
import { Moon, Sun } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import WhatsAppBubble from "./WhatsAppBubble";
import WhatsAppChatSurface from "./WhatsAppChatSurface";
import WhatsAppPhoneFrame from "./WhatsAppPhoneFrame";
import { EMPTY_PREVIEW, type MessagePreviewData } from "./types";

function isEmptyMessage(d: MessagePreviewData) {
  const hasText = d.headerType === "TEXT" && !!d.headerText;
  const hasMedia =
    d.headerType === "IMAGE" ||
    d.headerType === "VIDEO" ||
    d.headerType === "DOCUMENT";
  return (
    !hasText && !hasMedia && !d.body && !d.footer && d.buttons.length === 0
  );
}

/**
 * Reusable, presentational WhatsApp message preview.
 * - `variant="phone"` (default): full device shell — used on the editor stage.
 * - `variant="bubble"`: just the chat surface + bubble — reuse in reviews.
 * Pass `data` directly, or use `LiveMessagePreview` to source it from the
 * shared `useMessagePreview` cache.
 */
export default function WhatsAppPreview({
  data,
  variant = "phone",
  businessName = "",
  time,
}: {
  data: MessagePreviewData | null;
  variant?: "phone" | "bubble";
  businessName?: string;
  time?: string;
}) {
  const { translate: t } = useTranslation();
  const [dark, setDark] = useState(false);

  const d = data ?? EMPTY_PREVIEW;
  const clock = time ?? dayjs().format("H:mm");

  const inner = isEmptyMessage(d) ? (
    <div className="wa-empty">
      {t("Tu mensaje aparecerá acá, tal como lo verá el cliente en WhatsApp.")}
    </div>
  ) : (
    <WhatsAppBubble data={d} time={clock} showIcons />
  );

  const surface = (
    <WhatsAppChatSurface dark={dark} rtl={d.rtl}>
      {inner}
    </WhatsAppChatSurface>
  );

  if (variant === "bubble") return surface;

  return (
    <div className="wa-stage">
      <div className="wa-stage-inner">
        <WhatsAppPhoneFrame
          businessName={businessName}
          time={clock}
          dark={dark}
          rtl={d.rtl}
        >
          {surface}
        </WhatsAppPhoneFrame>

        <button
          type="button"
          className="wa-theme-toggle"
          onClick={() => setDark((v) => !v)}
        >
          {dark ? <Sun size={14} /> : <Moon size={14} />}
          {dark ? t("WhatsApp claro") : t("WhatsApp oscuro")}
        </button>

        <div className="stage-cap">
          {t("Vista previa en vivo — así se ve tu mensaje en WhatsApp")}
        </div>
      </div>
    </div>
  );
}
