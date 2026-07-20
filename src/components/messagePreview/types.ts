import type { PreviewButton } from "@/components/templateButtons";

export type PreviewHeaderType =
  | "NONE"
  | "TEXT"
  | "IMAGE"
  | "VIDEO"
  | "DOCUMENT";

/**
 * Normalized shape a WhatsApp message preview needs to render. Kept independent
 * of the template form / API types so the preview is reusable (template editor,
 * bulk-send review, …). Variables ({{n}}) are carried as their sample values;
 * `rtl` is precomputed by the producer (first-strong-char direction ‖ language).
 */
export interface MessagePreviewData {
  headerType: PreviewHeaderType;
  headerText: string;
  /** Sample values for header {{n}} placeholders. */
  headerVars: string[];
  /** Local object URL for a sample image/video/document (preview only). */
  mediaUrl: string;
  mediaName: string;
  body: string;
  /** Sample values for body {{n}} placeholders. */
  bodyVars: string[];
  footer: string;
  buttons: PreviewButton[];
  rtl: boolean;
}

export const EMPTY_PREVIEW: MessagePreviewData = {
  headerType: "NONE",
  headerText: "",
  headerVars: [],
  mediaUrl: "",
  mediaName: "",
  body: "",
  bodyVars: [],
  footer: "",
  buttons: [],
  rtl: false,
};
