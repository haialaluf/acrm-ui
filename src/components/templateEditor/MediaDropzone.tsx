import { Upload } from "antd";
import {
  X,
  FileText,
  Image as ImageIcon,
  Video as VideoIcon,
} from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

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

/** Sample media picker for the header. WhatsApp templates carry no fixed media
    (the real file is provided at send time), so the chosen file is a LOCAL blob
    used only to make the live preview realistic — it is never uploaded. */
export default function MediaDropzone({
  type,
  url,
  name,
  onFile,
  onClear,
}: {
  type: MediaType;
  url: string;
  name: string;
  onFile: (url: string, name: string) => void;
  onClear: () => void;
}) {
  const { translate: t } = useTranslation();
  const spec = SPEC[type];

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
            {spec.tag} · {t("solo para la vista previa")}
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
    <Upload.Dragger
      accept={spec.accept}
      showUploadList={false}
      maxCount={1}
      className="media-dragger"
      beforeUpload={(file) => {
        onFile(URL.createObjectURL(file), file.name);
        return false; // keep it local — never upload
      }}
    >
      <div className="media-drop-ic">
        <TypeIcon type={type} />
      </div>
      <div className="media-drop-t">
        {t("Soltá el archivo acá o")}{" "}
        <span className="text-primary">{t("explorá")}</span>
      </div>
      <div className="media-drop-s">{t(spec.hint)}</div>
    </Upload.Dragger>
  );
}
