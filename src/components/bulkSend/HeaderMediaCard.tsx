import { useState } from "react";
import { FileText, Image as ImageIcon, Video } from "lucide-react";

import { useTranslation } from "@/hooks/useTranslation";
import { type HeaderMediaFormat, isValidMediaUrl } from "./types";

const FORMAT_META: Record<
  HeaderMediaFormat,
  { icon: typeof ImageIcon; label: string; placeholder: string }
> = {
  IMAGE: {
    icon: ImageIcon,
    label: "Imagen del encabezado",
    placeholder: "https://ejemplo.com/imagen.jpg",
  },
  VIDEO: {
    icon: Video,
    label: "Video del encabezado",
    placeholder: "https://ejemplo.com/video.mp4",
  },
  DOCUMENT: {
    icon: FileText,
    label: "Documento del encabezado",
    placeholder: "https://ejemplo.com/documento.pdf",
  },
};

/** Editor for a template's mandatory media header (image/video/document).
 *  WhatsApp requires a media file for these templates; the file is provided as
 *  a public URL that Meta fetches when the message is delivered. */
export default function HeaderMediaCard({
  format,
  value,
  example,
  onChange,
}: {
  format: HeaderMediaFormat;
  value: string;
  example?: string;
  onChange: (url: string) => void;
}) {
  const { translate: t } = useTranslation();
  const meta = FORMAT_META[format];
  const Icon = meta.icon;
  const [imgError, setImgError] = useState(false);

  const trimmed = value.trim();
  const valid = isValidMediaUrl(trimmed);

  return (
    <div
      className="rounded-[12px] p-[12px]"
      style={{
        background: "var(--background)",
        border: "1px solid var(--border)",
      }}
    >
      <div className="flex items-center gap-[8px] mb-[10px]">
        <Icon className="w-[16px] h-[16px] text-muted-foreground" />
        <span className="text-[13px] font-medium">{t(meta.label)}</span>
        <span
          className="text-[10px] rounded-full px-[6px] py-[1px]"
          style={{
            background: "oklch(from var(--primary) l c h / 0.12)",
            color: "var(--primary)",
          }}
        >
          {t("Obligatorio")}
        </span>
      </div>

      {format === "IMAGE" && valid && !imgError && (
        <div
          className="mb-[10px] rounded-[8px] overflow-hidden"
          style={{ border: "1px solid var(--border)" }}
        >
          <img
            src={trimmed}
            alt={t("Vista previa")}
            className="w-full max-h-[180px] object-cover block"
            onError={() => setImgError(true)}
            onLoad={() => setImgError(false)}
          />
        </div>
      )}

      <input
        type="url"
        inputMode="url"
        dir="ltr"
        className="w-full text-[14px] rounded-[8px] p-[8px] outline-none"
        style={{
          background: "var(--background)",
          border: `1px solid ${
            trimmed && !valid ? "var(--destructive)" : "var(--border)"
          }`,
        }}
        placeholder={meta.placeholder}
        value={value}
        onChange={(e) => {
          setImgError(false);
          onChange(e.target.value);
        }}
      />

      {trimmed && !valid ? (
        <div
          className="text-[11px] mt-[6px]"
          style={{ color: "var(--destructive)" }}
        >
          {t("Introduce una URL pública que empiece por http:// o https://")}
        </div>
      ) : format === "IMAGE" && valid && imgError ? (
        <div
          className="text-[11px] mt-[6px]"
          style={{ color: "var(--destructive)" }}
        >
          {t("No se pudo cargar la imagen desde esa URL")}
        </div>
      ) : (
        <div className="text-[11px] mt-[6px] text-muted-foreground">
          {t(
            "Se enviará la misma imagen a todos los destinatarios. WhatsApp la descargará desde esta URL pública.",
          )}
        </div>
      )}

      {example && example !== trimmed && (
        <button
          type="button"
          onClick={() => {
            setImgError(false);
            onChange(example);
          }}
          className="text-[11px] mt-[8px] bg-transparent border-none p-0 cursor-pointer"
          style={{ color: "var(--primary)" }}
        >
          {t("Usar el archivo de ejemplo de la plantilla")}
        </button>
      )}
    </div>
  );
}
