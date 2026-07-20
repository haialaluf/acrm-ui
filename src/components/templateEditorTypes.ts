import type { FormTemplateButton } from "./templateButtons";

export type HeaderType = "NONE" | "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT";

export interface TemplateFormData {
  name: string;
  language: string;
  category: "MARKETING" | "UTILITY";
  headerType: HeaderType;
  header: string;
  headerVariable: string;
  // Preview-only: a local sample media file (blob URL). WhatsApp templates
  // carry no fixed media — the real file is provided at send time — so these
  // are used solely to make the live preview realistic and are never submitted.
  mediaUrl: string;
  mediaName: string;
  body: string;
  // `value` is the sample sent to Meta (example.body_text); `field` is an
  // optional UI hint (contact field) used only to auto-fill a realistic sample.
  bodyVariables: { value: string; field?: string }[];
  footer: string;
  buttons: FormTemplateButton[];
}
