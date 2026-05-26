import type { FormTemplateButton } from "./templateButtons";

export interface TemplateFormData {
  name: string;
  language: string;
  category: "MARKETING" | "UTILITY";
  header: string;
  headerVariable: string;
  body: string;
  bodyVariables: { value: string }[];
  footer: string;
  buttons: FormTemplateButton[];
}
