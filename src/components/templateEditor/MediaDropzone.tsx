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

type MediaType = "IMAGE" | "VIDEO" | "DOCUMENT";

const SPEC: Record<MediaType, { accept: string; tag: string; hint: string }> = {
  IMAGE: {
    accept: "image/png,image/jpeg",
    tag: "PNG / JPG",
    hint: "Hasta 5 MB · 1:1 (cuadrada) o 1.91:1 (apaisada) se ven mejor",
  },
  VIDEO: {
    accept: "video/mp4",
    tag: "MP4",
    hint: "Hasta 16 MB · muestra un botón de reproducción en el chat",
  },
  DOCUMENT: {
    accept: "application/pdf",
    tag: "PDF",
    hint: "Hasta 10 MB · aparece como una tarjeta de archivo",
  },
};

function TypeIcon({ type, size = 22 }: { type: MediaType; size?: number }) {
  if (type === "IMAGE") return <ImageIcon size={size} />;
  if (type === "VIDEO") return <VideoIcon size={size} />;
  return <FileText size={size} />;
}

/** Sample media picker for the header. Meta requires a sample asset to review a
    media-header template, so the chosen file is uploaded to our `media` bucket
    and its signed URL is submitted as the template's example (the edge function
    converts it into a Meta asset handle). At send time the real per-message file
    is attached separately (see bulk-send). */
export default function MediaDropzone({
  type,
  url,
  name,
  orgId,
  onFile,
  onClear,
}: {
  type: MediaType;
  url: string;
  name: string;
  orgId?: string;
  onFile: (url: string, name: string) => void;
  onClear: () => void;
}) {
  const { translate: t } = useTranslation();
  const spec = SPEC[type];
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (url) {
    return (
      <div className="media-picked">
        <div className="media-thumb">
          {type === "IMAGE" ? (
            <img src={url} alt="" />
          ) : type === "VIDEO" ? (
            <video src={url} muted />
          ) : (
            <span className="media-doc-ic">
              <FileText size={20} />
            </span>
          )}
        </div>
        <div className="media-picked-meta">
          <div className="media-picked-name">{name}</div>
          <div className="media-picked-sub">
            {spec.tag} · {t("muestra para la revisión")}
          </div>
        </div>
        <button
          type="button"
          className="w-[28px] h-[28px] rounded-full inline-flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-destructive shrink-0"
          title={t("Quitar")}
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
          uploadMediaToBucket(file, orgId, file.name)
            .then((signedUrl) => onFile(signedUrl, file.name))
            .catch((e) =>
              setError(
                e instanceof Error
                  ? e.message
                  : t("No se pudo subir el archivo"),
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
            t("Subiendo…")
          ) : (
            <>
              {t("Soltá el archivo acá o")}{" "}
              <span className="text-primary">{t("explorá")}</span>
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
