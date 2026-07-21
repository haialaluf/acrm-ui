import type { FormTemplateButton } from "./templateButtons";

export type HeaderType = "NONE" | "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT";

export interface TemplateFormData {
  name: string;
  language: string;
  category: "MARKETING" | "UTILITY";
  headerType: HeaderType;
  header: string;
  headerVariable: string;
  // Sample media for a media header: after upload, `mediaUrl` is a signed URL
  // in our `media` bucket, submitted as the template's example (Meta requires a
  // sample asset to review it; the edge function turns the URL into a Meta asset
  // handle). Also drives the live preview. The real per-message file is still
  // provided at send time. `mediaName` is the display label only.
  mediaUrl: string;
  mediaName: string;
  body: string;
  // `value` is the sample sent to Meta (example.body_text); `field` is an
  // optional UI hint (contact field) used only to auto-fill a realistic sample.
  bodyVariables: { value: string; field?: string }[];
  footer: string;
  buttons: FormTemplateButton[];
}
