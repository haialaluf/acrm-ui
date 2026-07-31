import type { FilePart } from "@/supabase/client";

export type MediaCategory = "audio" | "image" | "video" | "document";

/**
 * Resolves a file part to the renderer category it should use.
 *
 * Some kinds are unambiguous and map directly regardless of MIME — a sticker is
 * always an image. The rest (a story can be a photo or a video, and the generic
 * "media" kind has no fixed shape) are decided by the MIME type. The native IG
 * "file" kind (e.g. a shared pdf) and WhatsApp "document" are always documents.
 *
 * Shared posts/reels are not handled here: they are not files but `share` data
 * parts (a link card), since their url is a web permalink, not media.
 */
export function mediaCategory(
  kind: FilePart["kind"],
  mime: string,
): MediaCategory {
  switch (kind) {
    case "audio":
      return "audio";
    case "image":
    case "sticker":
      return "image";
    case "video":
      return "video";
    case "file":
    case "document":
      return "document";
  }

  // Ambiguous kinds (media, story, ig_story, story_mention, story_reply) — fall
  // back to the MIME type.
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("image/")) return "image";
  return "document";
}

// WhatsApp-style image display box. Portrait/square images are shown narrower
// and taller; landscape wider and shorter. Height is capped so extreme ratios
// don't run off — the caller crops the overflow with `object-fit: cover`.
export const PORTRAIT_WIDTH = 240;
export const LANDSCAPE_WIDTH = 320;
export const MAX_PORTRAIT_HEIGHT = (PORTRAIT_WIDTH * 4) / 3; // 320
export const MAX_LANDSCAPE_HEIGHT = (LANDSCAPE_WIDTH * 3) / 4; // 240

/** Lowercased file extension, e.g. "report.PDF" → "pdf". */
export function extension(filename: string | undefined) {
  return filename?.split(".").slice(-1)[0]?.toLowerCase();
}

/** Path to the document-type icon asset for a filename. */
export function iconName(filename: string | undefined) {
  switch (extension(filename)) {
    case "pdf":
      return "/pdf.png";
    case "doc":
    case "docx":
      return "/doc.png";
    case "xls":
    case "xlsx":
      return "/xls.png";
    default:
      return "/file.png";
  }
}

/** Display box (px) for an image given its natural pixel size. */
export function whatsappImageSize(naturalWidth: number, naturalHeight: number) {
  const isPortrait = naturalHeight >= naturalWidth; // square counts as portrait
  const width = isPortrait ? PORTRAIT_WIDTH : LANDSCAPE_WIDTH;
  const maxHeight = isPortrait ? MAX_PORTRAIT_HEIGHT : MAX_LANDSCAPE_HEIGHT;
  const height = Math.min(maxHeight, naturalHeight / (naturalWidth / width));
  return { width, height };
}
