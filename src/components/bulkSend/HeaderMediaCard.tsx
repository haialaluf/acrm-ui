import { useState } from "react";
import { FileText, Image as ImageIcon, Loader2, Video } from "lucide-react";

import { useTranslation } from "@/hooks/useTranslation";
import useBoundStore from "@/stores/useBoundStore";
import { type HeaderMediaFormat, isValidMediaUrl } from "./types";
import { rehostTemplateExample } from "./rehostMedia";

const FORMAT_META: Record<
  HeaderMediaFormat,
  { icon: typeof ImageIcon; label: string; placeholder: string }
> = {
  IMAGE: {
    icon: ImageIcon,
    label: "Header image",
    placeholder: "https://ejemplo.com/imagen.jpg",
  },
  VIDEO: {
    icon: Video,
    label: "Header video",
    placeholder: "https://ejemplo.com/video.mp4",
  },
  DOCUMENT: {
    icon: FileText,
    label: "Header document",
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
  const [rehosting, setRehosting] = useState(false);
  const [rehostError, setRehostError] = useState<string | null>(null);

  const activeOrgId = useBoundStore((s) => s.ui.activeOrgId);

  const trimmed = value.trim();
  const valid = isValidMediaUrl(trimmed);

  // The template's example is a Meta `header_handle` URL that Meta itself
  // refuses to fetch at send time (403 → error 131053). Copy its bytes into our
  // own storage and use the resulting signed URL instead of the raw handle.
  const useExample = async () => {
    if (!example || !activeOrgId || rehosting) return;
    setRehosting(true);
    setRehostError(null);
    setImgError(false);
    try {
      const url = await rehostTemplateExample(example, activeOrgId);
      onChange(url);
    } catch (err) {
      setRehostError(
        err instanceof Error ? err.message : "Failed to use example media",
      );
    } finally {
      setRehosting(false);
    }
  };

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
          {t("Required")}
        </span>
      </div>

      {format === "IMAGE" && valid && !imgError && (
        <div
          className="mb-[10px] rounded-[8px] overflow-hidden"
          style={{ border: "1px solid var(--border)" }}
        >
          <img
            src={trimmed}
            alt={t("Preview")}
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
          {t("Enter a public URL that starts with http:// or https://")}
        </div>
      ) : format === "IMAGE" && valid && imgError ? (
        <div
          className="text-[11px] mt-[6px]"
          style={{ color: "var(--destructive)" }}
        >
          {t("Couldn't load the image from that URL")}
        </div>
      ) : (
        <div className="text-[11px] mt-[6px] text-muted-foreground">
          {t(
            "The same image will be sent to all recipients. WhatsApp will download it from this public URL.",
          )}
        </div>
      )}

      {example && example !== trimmed && (
        <button
          type="button"
          onClick={useExample}
          disabled={rehosting || !activeOrgId}
          className="flex items-center gap-[6px] text-[11px] mt-[8px] bg-transparent border-none p-0 cursor-pointer disabled:opacity-60 disabled:cursor-default"
          style={{ color: "var(--primary)" }}
        >
          {rehosting && <Loader2 className="w-[12px] h-[12px] animate-spin" />}
          {rehosting
            ? t("Preparing the example file…")
            : t("Use the template's sample file")}
        </button>
      )}

      {rehostError && (
        <div
          className="text-[11px] mt-[6px]"
          style={{ color: "var(--destructive)" }}
        >
          {t("Couldn't prepare the example file. Please try again.")}
        </div>
      )}
    </div>
  );
}
