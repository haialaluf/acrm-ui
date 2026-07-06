import { type TemplateData } from "@/supabase/client";
import { useTranslation } from "@/hooks/useTranslation";
import TemplatePreviewBubble from "./TemplatePreviewBubble";
import { renumberVars, getVarNumbers } from "./templateVars";
import {
  formButtonsToComponent,
  type FormTemplateButton,
} from "./templateButtons";
import type { TemplateFormData } from "./templateEditorTypes";

// Builds a live TemplateData from the editor's form values and renders the
// WhatsApp-style preview bubble. Kept as its own component so TemplateEditor
// stays focused on the form.
export default function TemplateEditorPreview({
  values,
  existingId,
  existingStatus,
}: {
  values: Pick<
    TemplateFormData,
    | "name"
    | "language"
    | "category"
    | "header"
    | "headerVariable"
    | "body"
    | "bodyVariables"
    | "footer"
    | "buttons"
  >;
  existingId?: string;
  existingStatus?: TemplateData["status"];
}) {
  "use no memo";
  const { translate: t } = useTranslation();

  const {
    name,
    language,
    category,
    header,
    headerVariable,
    body,
    bodyVariables,
    footer,
    buttons,
  } = values;

  // Renumber so {{N}} indices line up with the example array positions.
  const { text: previewBody } = renumberVars(body);
  const previewVars = getVarNumbers(body).map(
    (_, i) => bodyVariables?.[i]?.value || "",
  );

  const buttonsComponent = formButtonsToComponent(
    (buttons || []) as FormTemplateButton[],
  );

  const previewTemplate: TemplateData = {
    id: existingId || "",
    name,
    status: existingStatus || "PENDING",
    category,
    sub_category: "CUSTOM",
    language,
    components: [
      ...(header
        ? [
            {
              type: "HEADER" as const,
              text: header,
              format: "TEXT" as const,
              ...(header.includes("{{1}}") && headerVariable
                ? { example: { header_text: [headerVariable] as [string] } }
                : {}),
            },
          ]
        : []),
      {
        type: "BODY",
        text: previewBody,
        ...(previewVars.length
          ? { example: { body_text: [previewVars] } }
          : {}),
      },
      ...(footer ? [{ type: "FOOTER" as const, text: footer }] : []),
      ...(buttonsComponent ? [buttonsComponent] : []),
    ],
  };

  return (
    <label>
      <div className="label">{t("Previsualización")}</div>
      <TemplatePreviewBubble template={previewTemplate} />
    </label>
  );
}
