import type { ReactNode } from "react";
import {
  ChevronLeft,
  Video,
  Phone,
  MoreVertical,
  Smile,
  Mic,
} from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

function StatusIcons() {
  return (
    <span className="wa-status-icons">
      <svg width="17" height="11" viewBox="0 0 18 12" fill="currentColor">
        <rect x="0" y="7" width="3" height="5" rx="1" />
        <rect x="4.5" y="4.5" width="3" height="7.5" rx="1" />
        <rect x="9" y="2" width="3" height="10" rx="1" />
        <rect x="13.5" y="0" width="3" height="12" rx="1" opacity="0.4" />
      </svg>
      <svg width="16" height="12" viewBox="0 0 18 13" fill="currentColor">
        <path d="M9 3.5c2.3 0 4.4.9 6 2.4l1.4-1.5A11 11 0 0 0 9 1 11 11 0 0 0 1.6 4.4L3 5.9A8.9 8.9 0 0 1 9 3.5z" />
        <path d="M9 7.2c1.3 0 2.5.5 3.4 1.4L9 12 5.6 8.6A4.8 4.8 0 0 1 9 7.2z" />
      </svg>
      <svg width="24" height="12" viewBox="0 0 26 13" fill="none">
        <rect
          x="1"
          y="1.5"
          width="21"
          height="10"
          rx="2.5"
          stroke="currentColor"
          opacity="0.5"
        />
        <rect
          x="2.5"
          y="3"
          width="15"
          height="7"
          rx="1.2"
          fill="currentColor"
        />
        <rect
          x="23.5"
          y="4.5"
          width="1.6"
          height="4"
          rx="0.8"
          fill="currentColor"
          opacity="0.5"
        />
      </svg>
    </span>
  );
}

/** A realistic phone shell (status bar + WhatsApp chat header + composer) that
    frames the chat surface, so the preview reads like the real app. */
export default function WhatsAppPhoneFrame({
  businessName,
  time,
  dark,
  rtl,
  children,
}: {
  businessName: string;
  time: string;
  dark?: boolean;
  rtl?: boolean;
  children: ReactNode;
}) {
  const { translate: t } = useTranslation();
  const initial = (businessName || "B").trim().charAt(0).toUpperCase();

  return (
    <div className={"device" + (dark ? " dark" : "")}>
      <div className="screen">
        <div className="wa-status">
          <span>{time}</span>
          <StatusIcons />
        </div>

        <div className="wa-header" dir={rtl ? "rtl" : "ltr"}>
          <ChevronLeft className="wa-back" size={22} />
          <div className="wa-ava">{initial}</div>
          <div className="wa-peer">
            <div className="wa-name">{businessName || t("Negocio")}</div>
            <div className="wa-presence">{t("en línea")}</div>
          </div>
          <div className="wa-hicons">
            <Video size={20} />
            <Phone size={18} />
            <MoreVertical size={18} />
          </div>
        </div>

        {children}

        <div className="wa-composer" dir={rtl ? "rtl" : "ltr"}>
          <div className="wa-input">
            <Smile size={18} />
            <span>{t("Mensaje")}</span>
          </div>
          <div className="wa-mic">
            <Mic size={18} color="#fff" />
          </div>
        </div>
      </div>
    </div>
  );
}
