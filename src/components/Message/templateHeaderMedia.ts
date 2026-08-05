import { type Template } from "@/supabase/client";
import { type HeaderMediaFormat } from "@/components/bulkSend/types";

export type TemplateHeaderMedia = {
  format: HeaderMediaFormat;
  /** Public/signed URL Meta fetched the file from at delivery time. */
  link: string;
  filename?: string;
};

/** The media file attached to a template's header, read back out of the stored
 *  Meta send payload (`content.data`).
 *
 *  A media header is not part of the flattened display text — it carries no
 *  text at all — so the chat bubble has to recover it from the payload it was
 *  sent with. Returns `null` when the header is textual (already rendered as
 *  part of `content.text`), absent, or carries a Meta media `id` instead of a
 *  `link`: an id is only resolvable through the Graph API, so there is nothing
 *  the browser can display. */
export function templateHeaderMedia(
  template: Template,
): TemplateHeaderMedia | null {
  const header = template.components?.find((c) => c.type === "header");
  const param = header?.type === "header" ? header.parameters?.[0] : undefined;
  if (!param) return null;

  switch (param.type) {
    case "image":
      return "link" in param.image
        ? { format: "IMAGE", link: param.image.link }
        : null;
    case "video":
      return "link" in param.video
        ? { format: "VIDEO", link: param.video.link }
        : null;
    case "document":
      return "link" in param.document
        ? {
            format: "DOCUMENT",
            link: param.document.link,
            filename: param.document.filename,
          }
        : null;
    default:
      return null;
  }
}

/** Best-effort display name for a header document: the basename of its URL,
 *  when the payload did not carry an explicit `filename`. */
export function mediaBasename(link: string): string {
  try {
    return decodeURIComponent(new URL(link).pathname.split("/").pop() || "");
  } catch {
    return "";
  }
}
