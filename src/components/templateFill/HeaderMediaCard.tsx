import { useState } from "react";
import { FileText, Image as ImageIcon, Loader2, Video } from "lucide-react";

import MediaDropzone from "@/components/media/MediaDropzone";
import { useTranslation } from "@/hooks/useTranslation";
import useBoundStore from "@/stores/useBoundStore";
import { type HeaderMediaFormat } from "./types";
import { rehostTemplateExample } from "./rehostMedia";

/** `note` spells out that media, unlike every other field in this step, cannot
 *  vary per recipient — the neighbouring `VarCard`s all offer a per-recipient
 *  option, so the contrast is worth stating. */
const FORMAT_META: Record<
  HeaderMediaFormat,
  { icon: typeof ImageIcon; label: string; note: string }
> = {
  IMAGE: {
    icon: ImageIcon,
    label: "Header image",
    note: "The same image will be sent to all recipients.",
  },
  VIDEO: {
    icon: Video,
    label: "Header video",
    note: "The same video will be sent to all recipients.",
  },
  DOCUMENT: {
    icon: FileText,
    label: "Header document",
    note: "The same document will be sent to all recipients.",
  },
};

/** Best-effort display name for a file we did not pick ourselves: the basename
 *  of the example URL's path. Meta handles do not always carry a meaningful
 *  filename, so an empty result is fine — `MediaDropzone` falls back to the
 *  format tag. */
function basenameOf(url: string): string {
  try {
    return decodeURIComponent(new URL(url).pathname.split("/").pop() || "");
  } catch {
    return "";
  }
}

/** Editor for a template's mandatory media header (image/video/document).
 *  WhatsApp requires a media file for these templates; the file is uploaded to
 *  our `media` bucket and Meta fetches its signed URL when the message is
 *  delivered. Uses the same dropzone as the template editor's header picker. */
export default function HeaderMediaCard({
  format,
  value,
  name,
  example,
  note,
  expiresIn,
  onChange,
}: {
  format: HeaderMediaFormat;
  value: string;
  name: string;
  example?: string;
  /** Overrides the "same file to all recipients" line — an automation sends one
   *  contact at a time, so the broadcast wording would be wrong there. */
  note?: string;
  /** Signed-URL lifetime for the uploaded file, in seconds. See
   *  `DURABLE_MEDIA_SIGNED_URL_TTL_SECONDS` for why an automation needs one. */
  expiresIn?: number;
  onChange: (url: string, name: string, size?: number) => void;
}) {
  const { translate: t } = useTranslation();
  const meta = FORMAT_META[format];
  const Icon = meta.icon;
  const [rehosting, setRehosting] = useState(false);
  const [rehostError, setRehostError] = useState<string | null>(null);

  const activeOrgId = useBoundStore((s) => s.ui.activeOrgId);

  // The template's example is a Meta `header_handle` URL that Meta itself
  // refuses to fetch at send time (403 → error 131053). Copy its bytes into our
  // own storage and use the resulting signed URL instead of the raw handle.
  const useExample = async () => {
    if (!example || !activeOrgId || rehosting) return;
    setRehosting(true);
    setRehostError(null);
    try {
      const url = await rehostTemplateExample(
        example,
        activeOrgId,
        format,
        expiresIn,
      );
      onChange(url, basenameOf(example));
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

      <MediaDropzone
        type={format}
        url={value}
        name={name}
        orgId={activeOrgId ?? undefined}
        expiresIn={expiresIn}
        onFile={onChange}
        onClear={() => onChange("", "")}
      />

      <div className="text-[11px] mt-[6px] text-muted-foreground">
        {note ?? t(meta.note)}
      </div>

      {example && example !== value.trim() && (
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
