import { type ReactEventHandler, useEffect, useState } from "react";
import { Play } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import VideoThumb from "@/components/media/VideoThumb";
import {
  whatsappImageSize,
  extension,
  iconName,
  fileSize,
} from "@/components/Message/media";
import type { PreviewHeaderType } from "./types";

/** The media block at the top of a bubble: image / video / document. */
export default function MediaHeader({
  type,
  url,
  fileName,
  size,
  onSize,
}: {
  type: PreviewHeaderType;
  url: string;
  fileName: string;
  /** Document byte size, rendered next to the type ("PDF · 21 KB"). */
  size?: number;
  /** Reports the image's display width so the bubble can shrink to match it. */
  onSize?: (width: number) => void;
}) {
  const { translate: t } = useTranslation();
  const [box, setBox] = useState<{ width: number; height: number } | null>(
    null,
  );

  // The size is known immediately for a freshly-uploaded file (`size` prop). For
  // a document that came from a URL (e.g. the template example), read it from
  // the response's Content-Length via a HEAD request. Degrades to just the type
  // when neither is available (CORS, missing header).
  const [fetchedSize, setFetchedSize] = useState<number | null>(null);
  useEffect(() => {
    if (type !== "DOCUMENT" || size != null || !url) {
      setFetchedSize(null);
      return;
    }
    let alive = true;
    fetch(url, { method: "HEAD" })
      .then((res) => {
        const len = Number(res.headers.get("content-length"));
        if (alive && Number.isFinite(len) && len > 0) setFetchedSize(len);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [type, size, url]);

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
    const name = fileName || "document.pdf";
    const ext = extension(name);
    const bytes = size ?? fetchedSize;
    return (
      <div className="wa-doc">
        <img className="wa-doc-ic" src={iconName(name)} alt="" />
        <div className="wa-doc-meta">
          <div className="wa-doc-name">{name}</div>
          <div className="wa-doc-sub">
            {ext ? ext.toUpperCase() : t("Document")}
            {bytes != null && bytes > 0 ? ` · ${fileSize(bytes)}` : ""}
          </div>
        </div>
        {/* Same download glyph (circle + arrow) the real chat uses. */}
        <svg className="wa-doc-dl">
          <use href="/icons.svg#download" />
        </svg>
      </div>
    );
  }

  return null;
}
