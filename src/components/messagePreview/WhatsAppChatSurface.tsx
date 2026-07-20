import type { ReactNode } from "react";
import { useTranslation } from "@/hooks/useTranslation";

/** The WhatsApp chat area: tiled wallpaper + a "Today" day pill, wrapping the
    message bubble. Reusable on its own (e.g. bulk-send review, without a phone
    frame). */
export default function WhatsAppChatSurface({
  dark,
  rtl,
  children,
}: {
  dark?: boolean;
  rtl?: boolean;
  children: ReactNode;
}) {
  const { translate: t } = useTranslation();
  return (
    <div
      className={"wa-chat" + (dark ? " dark" : "")}
      dir={rtl ? "rtl" : "ltr"}
    >
      <div className="wa-daypill">{t("Hoy")}</div>
      {children}
    </div>
  );
}
