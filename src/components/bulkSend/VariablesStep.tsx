import { ArrowLeft } from "lucide-react";

import Button from "@/components/Button";
import SectionFooter from "@/components/SectionFooter";
import WhatsAppPreview from "@/components/messagePreview/WhatsAppPreview";
import TemplateVarsEditor, {
  varsIntro,
} from "@/components/templateFill/TemplateVarsEditor";
import {
  bindingPreviewValues,
  templatePreviewData,
} from "@/components/templateFill/previewData";
import {
  applyBindingPatch,
  headerMediaFormat as headerMediaFormatOf,
  templateSlots,
} from "@/components/templateFill/types";
import { useTranslation } from "@/hooks/useTranslation";
import { type TemplateData } from "@/supabase/client";

import {
  FIELD_OPTIONS,
  isValidMediaUrl,
  type ContactField,
  type VarValue,
} from "./types";

/** Step 3 — for each `{{N}}`, choose a static value or a per-recipient field.
 *  The bubble underneath is the same preview the review step shows, with each
 *  binding highlighted in place of its `{{N}}` — there is no recipient to
 *  resolve against yet, so a field binding reads as its own name.
 *
 *  Both halves are the shared `templateFill` blocks: the automation editor's
 *  send-template step asks for exactly the same things, and this step is now
 *  only the wizard chrome around them. */
export default function VariablesStep({
  template,
  vars,
  setVars,
  headerMedia,
  headerMediaName,
  headerMediaSize,
  setHeaderMedia,
  onNext,
}: {
  template: TemplateData;
  vars: Record<string, VarValue>;
  setVars: (v: Record<string, VarValue>) => void;
  headerMedia: string;
  headerMediaName: string;
  /** Only a document header shows its size, as "PDF · 21 KB". */
  headerMediaSize?: number;
  setHeaderMedia: (url: string, name: string, size?: number) => void;
  onNext: () => void;
}) {
  const { translate: t } = useTranslation();

  const mediaFormat = headerMediaFormatOf(template.components);
  // A media header requires a valid public URL before the user can continue.
  const mediaOk = !mediaFormat || isValidMediaUrl(headerMedia);
  const hasInputs =
    templateSlots(template.components).length > 0 || !!mediaFormat;

  const allFilled =
    mediaOk &&
    Object.values(vars).every(
      (v) =>
        v.mode === "field" || (v.mode === "static" && v.static.trim() !== ""),
    );

  const intro = varsIntro(template.components, t);

  return (
    <>
      <div className="grow overflow-y-auto">
        <div className="px-[16px] pt-[14px] pb-[16px]">
          {intro && (
            <div className="text-[14px] leading-[20px] mb-[16px]">{intro}</div>
          )}

          {hasInputs && (
            <div className="text-[12px] font-semibold mb-[8px] text-muted-foreground">
              {t("Variables")}
            </div>
          )}

          <TemplateVarsEditor<ContactField>
            components={template.components}
            bindings={vars}
            fields={FIELD_OPTIONS}
            onUpdate={(scope, n, patch) => {
              const key = `${scope}.${n}`;
              setVars({
                ...vars,
                [key]: applyBindingPatch(vars[key], patch, FIELD_OPTIONS),
              });
            }}
            media={{
              value: headerMedia,
              name: headerMediaName,
              onChange: setHeaderMedia,
            }}
            empty={t("This template has no variables — you can continue")}
          />

          <div className="text-[12px] font-semibold mt-[20px] mb-[8px] text-muted-foreground">
            {t("Preview")}
          </div>
          {/* The client's own bubble, not a summary of it: each binding shows as
              a highlighted value inside the real message, so the footer, the
              buttons and the media header are all part of what you check. */}
          <div className="rounded-[14px] overflow-hidden">
            <WhatsAppPreview
              variant="bubble"
              data={templatePreviewData({
                components: template.components,
                values: bindingPreviewValues({
                  components: template.components,
                  bindings: vars,
                  fields: FIELD_OPTIONS,
                  t,
                }),
                language: template.language,
                media: {
                  url: headerMedia,
                  name: headerMediaName,
                  size: headerMediaSize,
                },
                copyCodeLabel: t("Copy code"),
              })}
            />
          </div>
        </div>
      </div>

      <SectionFooter>
        <Button className="primary" onClick={onNext} invalid={!allFilled}>
          <span className="inline-flex items-center justify-center gap-[8px]">
            {t("Preview and send")}
            <ArrowLeft className="w-[16px] h-[16px] rotate-180" />
          </span>
        </Button>
      </SectionFooter>
    </>
  );
}
