import { FileText, Play } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import type { PreviewHeaderType } from "./types";

/** The media block at the top of a bubble: image / video / document. */
export default function MediaHeader({
  type,
  url,
  fileName,
}: {
  type: PreviewHeaderType;
  url: string;
  fileName: string;
}) {
  const { translate: t } = useTranslation();

  if (type === "IMAGE") {
    return (
      <div className="wa-media">
        {url ? (
          <img src={url} alt="" />
        ) : (
          <div className="wa-media-ph">
            <span className="mono">{t("tu imagen")}</span>
          </div>
        )}
      </div>
    );
  }

  if (type === "VIDEO") {
    return (
      <div className="wa-media wa-video">
        {url ? (
          <video src={url} muted />
        ) : (
          <div className="wa-media-ph">
            <span className="mono">{t("tu video")}</span>
          </div>
        )}
        <div className="wa-play">
          <Play size={22} fill="#fff" stroke="none" />
        </div>
      </div>
    );
  }

  if (type === "DOCUMENT") {
    return (
      <div className="wa-doc">
        <div className="wa-doc-ic">
          <FileText size={20} className="text-destructive" />
        </div>
        <div className="wa-doc-meta">
          <div className="wa-doc-name">{fileName || "document.pdf"}</div>
          <div className="wa-doc-sub">{t("PDF · tocá para abrir")}</div>
        </div>
      </div>
    );
  }

  return null;
}
