import { type ReactEventHandler, useState } from "react";
import { FileText, Play } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import VideoThumb from "@/components/media/VideoThumb";
import { whatsappImageSize } from "@/components/Message/media";
import type { PreviewHeaderType } from "./types";

/** The media block at the top of a bubble: image / video / document. */
export default function MediaHeader({
  type,
  url,
  fileName,
  onSize,
}: {
  type: PreviewHeaderType;
  url: string;
  fileName: string;
  /** Reports the image's display width so the bubble can shrink to match it. */
  onSize?: (width: number) => void;
}) {
  const { translate: t } = useTranslation();
  const [box, setBox] = useState<{ width: number; height: number } | null>(
    null,
  );

  const onImgLoad: ReactEventHandler<HTMLImageElement> = (e) => {
    const img = e.currentTarget;
    applySize(img.naturalWidth, img.naturalHeight);
  };

  // Shape the media box to the file's natural ratio (like the real chat) and
  // report the width so the parent bubble hugs it — shared by image & video.
  const applySize = (naturalWidth: number, naturalHeight: number) => {
    const size = whatsappImageSize(naturalWidth, naturalHeight);
    setBox(size);
    onSize?.(size.width);
  };

  const mediaStyle = box
    ? { aspectRatio: `${box.width} / ${box.height}`, width: "100%" as const }
    : undefined;

  if (type === "IMAGE") {
    // Shape the box to the image's natural ratio (like the real chat) so the
    // preview matches what recipients see, instead of cropping to a fixed
    // landscape frame. The image fills the bubble width, which the parent
    // shrinks to `box.width` so the caption wraps under it with no side gap.
    return (
      <div className="wa-media" style={mediaStyle}>
        {url ? (
          <img src={url} alt="" onLoad={onImgLoad} />
        ) : (
          <div className="wa-media-ph">
            <span className="mono">{t("your image")}</span>
          </div>
        )}
      </div>
    );
  }

  if (type === "VIDEO") {
    return (
      <div className="wa-media wa-video" style={mediaStyle}>
        {url ? (
          <VideoThumb url={url} onMeta={applySize} />
        ) : (
          <div className="wa-media-ph">
            <span className="mono">{t("your video")}</span>
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
          <div className="wa-doc-sub">{t("PDF · tap to open")}</div>
        </div>
      </div>
    );
  }

  return null;
}
