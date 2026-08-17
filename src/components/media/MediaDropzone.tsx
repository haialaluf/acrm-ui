import { useState } from "react";
import { Upload } from "antd";
import {
  X,
  Loader2,
  FileText,
  Image as ImageIcon,
  Video as VideoIcon,
} from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { uploadMediaToBucket } from "@/utils/uploadMediaToBucket";
import VideoThumb from "./VideoThumb";

type MediaType = "IMAGE" | "VIDEO" | "DOCUMENT";

const SPEC: Record<MediaType, { accept: string; tag: string; hint: string }> = {
  IMAGE: {
    accept: "image/png,image/jpeg",
    tag: "PNG / JPG",
    hint: "Up to 5 MB · 1:1 (square) or 1.91:1 (wide) look best",
  },
  VIDEO: {
    accept: "video/mp4",
    tag: "MP4",
    hint: "Up to 16 MB · shows a play button in the chat",
  },
  DOCUMENT: {
    accept: "application/pdf",
    tag: "PDF",
    hint: "Up to 10 MB · appears as a file card",
  },
};

function TypeIcon({ type, size = 22 }: { type: MediaType; size?: number }) {
  if (type === "IMAGE") return <ImageIcon size={size} />;
  if (type === "VIDEO") return <VideoIcon size={size} />;
  return <FileText size={size} />;
}

/** Media picker for a WhatsApp media header, shared by the template editor and
    the bulk-send wizard. The chosen file is uploaded to our private `media`
    bucket and the caller receives its signed URL.

    In the template editor the file is the *sample asset* Meta requires to review
    a media-header template (the edge function converts the signed URL into a
    Meta asset handle). In bulk-send it is the actual file delivered to every
    recipient, which Meta fetches from the signed URL at send time.

    `name` and `subLabel` are optional because bulk-send can hold a URL with no
    known filename (the "use the template's sample file" shortcut); the format
    tag stands in for whichever is missing. */
export default function MediaDropzone({
  type,
  url,
  name,
  subLabel,
  orgId,
  expiresIn,
  onFile,
  onClear,
}: {
  type: MediaType;
  url: string;
  name?: string;
  subLabel?: string;
  orgId?: string;
  /** Signed-URL lifetime in seconds. Defaults to the bucket helper's week,
   *  which suits a file about to be sent; an automation step holds its file for
   *  as long as the flow runs and passes a much longer one. */
  expiresIn?: number;
  onFile: (url: string, name: string, size?: number) => void;
  onClear: () => void;
}) {
  const { translate: t } = useTranslation();
  const spec = SPEC[type];
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (url) {
    const sub = [name ? spec.tag : null, subLabel].filter(Boolean).join(" · ");
    return (
      <div className="media-picked">
        <div className="media-thumb">
          {type === "IMAGE" ? (
            <img src={url} alt="" />
          ) : type === "VIDEO" ? (
            <VideoThumb url={url} />
          ) : (
            <span className="media-doc-ic">
              <FileText size={20} />
            </span>
          )}
        </div>
        <div className="media-picked-meta">
          <div className="media-picked-name">{name || spec.tag}</div>
          {/* The format tag moves down here only when the filename occupies the
              line above it, so it is never shown twice. */}
          {sub && <div className="media-picked-sub">{sub}</div>}
        </div>
        <button
          type="button"
          className="w-[28px] h-[28px] rounded-full inline-flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-destructive shrink-0"
          title={t("Remove")}
          onClick={onClear}
        >
          <X size={15} />
        </button>
      </div>
    );
  }

  return (
    <>
      <Upload.Dragger
        accept={spec.accept}
        showUploadList={false}
        maxCount={1}
        disabled={uploading || !orgId}
        className="media-dragger"
        beforeUpload={(file) => {
          if (!orgId) return false;
          setError(null);
          setUploading(true);
          uploadMediaToBucket(file, orgId, file.name, expiresIn)
            .then((signedUrl) => onFile(signedUrl, file.name, file.size))
            .catch((e) =>
              setError(
                e instanceof Error ? e.message : t("Couldn't upload the file"),
              ),
            )
            .finally(() => setUploading(false));
          return false; // we upload ourselves — never let antd POST it
        }}
      >
        <div className="media-drop-ic">
          {uploading ? (
            <Loader2 className="animate-spin" size={22} />
          ) : (
            <TypeIcon type={type} />
          )}
        </div>
        <div className="media-drop-t">
          {uploading ? (
            t("Uploading…")
          ) : (
            <>
              {t("Drop the file here or")}{" "}
              <span className="text-primary">{t("browse")}</span>
            </>
          )}
        </div>
        <div className="media-drop-s">{t(spec.hint)}</div>
      </Upload.Dragger>
      {error && (
        <div className="text-[11px] mt-[6px] text-destructive">{error}</div>
      )}
    </>
  );
}
