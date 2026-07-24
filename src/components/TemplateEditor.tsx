import { useEffect, useState } from "react";
import { Alert } from "antd";
import { type TemplateData } from "@/supabase/client";
import { useTranslation } from "@/hooks/useTranslation";
import { useForm } from "react-hook-form";
import { useNavigate } from "@tanstack/react-router";
import SectionBody from "./SectionBody";
import SectionFooter from "./SectionFooter";
import Button from "./Button";
import SelectField from "./SelectField";
import FieldError from "./FieldError";
import TemplateButtonsField from "./TemplateButtonsField";
import HeaderTypeField from "./templateEditor/HeaderTypeField";
import BodyField from "./templateEditor/BodyField";
import VariableMapper from "./templateEditor/VariableMapper";
import LiveMessagePreview from "./messagePreview/LiveMessagePreview";
import { detectRtl } from "./messagePreview/rtl";
import type { MessagePreviewData } from "./messagePreview/types";
import {
  componentToFormButton,
  formButtonToComponent,
  formButtonsToComponent,
  buttonDefToPreview,
  type PreviewButton,
} from "./templateButtons";
import { getVarNumbers, renumberVars } from "./templateVars";
import type { HeaderType, TemplateFormData } from "./templateEditorTypes";
import { useCreateTemplate, useUpdateTemplate } from "@/queries/useTemplates";
import { useSetMessagePreview } from "@/hooks/useMessagePreview";
import { isRtl, type Language } from "@/stores/uiSlice";
import useBoundStore from "@/stores/useBoundStore";

export default function TemplateEditor({
  existingTemplate,
  organizationAddress,
  onSaved,
}: {
  existingTemplate?: TemplateData;
  organizationAddress: string;
  /** Called after a successful save. When omitted, navigates up to the
   *  templates list (route behaviour). Supplied when the editor is embedded
   *  in an overlay (e.g. the bulk-send wizard) that must not change routes. */
  onSaved?: () => void;
}) {
  "use no memo";
  const { translate: t, currentLanguage } = useTranslation();
  const navigate = useNavigate();
  const setPreview = useSetMessagePreview();

  const activeOrgId = useBoundStore((state) => state.ui.activeOrgId);
  const createMutation = useCreateTemplate();
  const updateMutation = useUpdateTemplate();
  const isPending = createMutation.isPending || updateMutation.isPending;
  const [submitError, setSubmitError] = useState<string | null>(null);

  const existingHeader = existingTemplate?.components.find(
    (c) => c.type === "HEADER",
  );
  const existingBody = existingTemplate?.components.find(
    (c) => c.type === "BODY",
  );
  const existingButtons = existingTemplate?.components.find(
    (c) => c.type === "BUTTONS",
  );
  const defaultHeaderType: HeaderType = existingHeader
    ? (existingHeader.format ?? "TEXT")
    : "NONE";

  const { register, handleSubmit, control, watch, setValue, formState } =
    useForm<TemplateFormData>({
      mode: "onTouched",
      defaultValues: {
        name: existingTemplate?.name || "",
        language: existingTemplate?.language || currentLanguage || "es",
        category: existingTemplate?.category || "MARKETING",
        headerType: defaultHeaderType,
        header:
          existingHeader?.format === "TEXT" ? (existingHeader.text ?? "") : "",
        headerVariable: existingHeader?.example?.header_text?.[0] || "",
        // For a media header, prefill the preview from the reviewed sample Meta
        // returns (a scontent handle). It is left untouched on save unless the
        // user picks a new file — see buildHeaderComponent / the edge function.
        mediaUrl:
          existingHeader && existingHeader.format !== "TEXT"
            ? existingHeader.example?.header_handle?.[0] || ""
            : "",
        mediaName:
          existingHeader && existingHeader.format !== "TEXT"
            ? t("Muestra actual")
            : "",
        body: existingBody?.text || "",
        bodyVariables: (existingBody?.example?.body_text[0] || []).map(
          (v: string) => ({ value: v }),
        ),
        footer:
          existingTemplate?.components.find((c) => c.type === "FOOTER")?.text ||
          "",
        buttons: (existingButtons?.buttons || []).map(componentToFormButton),
      },
    });
  const { isDirty, isValid, errors } = formState;

  const headerType = watch("headerType");
  const headerText = watch("header");
  const headerVariable = watch("headerVariable");
  const mediaUrl = watch("mediaUrl");
  const mediaName = watch("mediaName");
  const body = watch("body");
  const footer = watch("footer");
  const category = watch("category");
  const language = watch("language");
  const bodyVariables = watch("bodyVariables");
  const buttons = watch("buttons");

  const bodyVarNumbers = getVarNumbers(body);
  const appDark =
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark");

  // Keep the bodyVariables rows in sync with the {{n}} found in the body.
  useEffect(() => {
    const current = bodyVariables || [];
    if (bodyVarNumbers.length !== current.length) {
      setValue(
        "bodyVariables",
        Array.from({ length: bodyVarNumbers.length }, (_, i) => ({
          value: current[i]?.value || "",
          field: current[i]?.field,
        })),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body]);

  // Copy-code buttons are MARKETING-only — drop them if the category changes.
  useEffect(() => {
    if (category !== "MARKETING") {
      const current = watch("buttons") || [];
      const filtered = current.filter((b) => b.kind !== "COPY");
      if (filtered.length !== current.length) {
        setValue("buttons", filtered, { shouldDirty: true });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  // Live preview: build the normalized payload and publish it to the shared
  // React Query cache (read by the phone preview in the center panel / mobile).
  const headerVars =
    headerType === "TEXT" && headerText.includes("{{1}}")
      ? [headerVariable]
      : [];
  const previewButtons: PreviewButton[] = (buttons || []).map((b) =>
    buttonDefToPreview(formButtonToComponent(b), t("Copiar código")),
  );
  const previewData: MessagePreviewData = {
    headerType,
    headerText: headerType === "TEXT" ? headerText : "",
    headerVars,
    mediaUrl,
    mediaName,
    body,
    bodyVars: bodyVarNumbers.map((_, i) => bodyVariables?.[i]?.value || ""),
    footer,
    buttons: previewButtons,
    rtl:
      detectRtl(body, headerType === "TEXT" ? headerText : "", footer) ||
      isRtl(language as Language),
  };
  const serializedPreview = JSON.stringify(previewData);
  useEffect(() => {
    setPreview(previewData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serializedPreview]);
  useEffect(() => () => void setPreview(null), [setPreview]);

  // Sample values are required by Meta for every variable — gate submit on them.
  const bodyVarsComplete = bodyVarNumbers.every(
    (_, i) => !!bodyVariables?.[i]?.value?.trim(),
  );
  const headerVarComplete =
    !(headerType === "TEXT" && headerText.includes("{{1}}")) ||
    !!headerVariable.trim();
  // Media headers need a sample asset for Meta's review — gate submit on it.
  const isMediaHeader =
    headerType === "IMAGE" ||
    headerType === "VIDEO" ||
    headerType === "DOCUMENT";
  const mediaHeaderComplete = !isMediaHeader || !!mediaUrl;

  function buildHeaderComponent(data: TemplateFormData) {
    if (data.headerType === "NONE") return null;
    if (data.headerType === "TEXT") {
      if (!data.header) return null;
      return {
        type: "HEADER" as const,
        format: "TEXT" as const,
        text: data.header,
        ...(data.header.includes("{{1}}") && data.headerVariable
          ? { example: { header_text: [data.headerVariable] as [string] } }
          : {}),
      };
    }
    // IMAGE / VIDEO / DOCUMENT: Meta requires a sample asset to review the
    // template. We submit the uploaded sample's signed URL as header_handle; the
    // edge function swaps it for a real Meta asset handle (Resumable Upload API)
    // before creating. An unchanged existing handle (edit) passes through as-is.
    // The real per-message file is still attached at send time (see bulk-send).
    return {
      type: "HEADER" as const,
      format: data.headerType,
      ...(data.mediaUrl ? { example: { header_handle: [data.mediaUrl] } } : {}),
    };
  }

  function onSubmit(data: TemplateFormData) {
    const { text: renumberedBody, ordered } = renumberVars(data.body);
    const reorderedVars = ordered.map(
      (_, i) => data.bodyVariables[i]?.value || "",
    );
    const headerComponent = buildHeaderComponent(data);
    const buttonsComponent = formButtonsToComponent(data.buttons);

    const template: TemplateData = {
      id: existingTemplate?.id || "",
      name: data.name,
      status: existingTemplate?.status || "PENDING",
      category: data.category,
      sub_category: "CUSTOM",
      language: data.language,
      components: [
        ...(headerComponent ? [headerComponent] : []),
        {
          type: "BODY",
          text: renumberedBody,
          ...(reorderedVars.length
            ? { example: { body_text: [reorderedVars] } }
            : {}),
        },
        ...(data.footer
          ? [{ type: "FOOTER" as const, text: data.footer }]
          : []),
        ...(buttonsComponent ? [buttonsComponent] : []),
      ],
    };

    setSubmitError(null);
    const mutation = existingTemplate ? updateMutation : createMutation;
    mutation.mutate(
      { template, organizationAddress },
      {
        onSuccess: () =>
          onSaved
            ? onSaved()
            : navigate({ to: "..", hash: (prevHash) => prevHash! }),
        onError: (error) =>
          setSubmitError(
            error instanceof Error
              ? error.message
              : t("No se pudo guardar la plantilla"),
          ),
      },
    );
  }

  const varRows = bodyVarNumbers.map((n, i) => ({
    n,
    field: bodyVariables?.[i]?.field,
    sample: bodyVariables?.[i]?.value || "",
  }));

  return (
    <>
      <SectionBody>
        {/* Mobile: the live preview stacks above the form (on desktop it lives
            in the center panel — see _auth.tsx). */}
        <div className="md:hidden mb-[12px] h-[320px] rounded-[16px] overflow-hidden border border-border flex flex-col">
          <LiveMessagePreview variant="bubble" />
        </div>

        <form id="template-form" onSubmit={handleSubmit(onSubmit)}>
          <SelectField<TemplateFormData>
            name="category"
            control={control}
            label={t("Categoría")}
            disabled={!!existingTemplate}
            options={[
              { value: "MARKETING", label: t("Promoción") },
              { value: "UTILITY", label: t("Utilidad") },
            ]}
          />

          <SelectField<TemplateFormData>
            name="language"
            control={control}
            label={t("Idioma")}
            disabled={!!existingTemplate}
            options={[
              { value: "en", label: "English" },
              { value: "he", label: "עברית" },
              { value: "es", label: "Español" },
              { value: "pt", label: "Português" },
            ]}
          />

          <label>
            <div className="label">{t("Nombre")}</div>
            <input
              type="text"
              className="text"
              placeholder={t("nombre_de_plantilla")}
              disabled={!!existingTemplate}
              {...register("name", {
                required: "El nombre es obligatorio",
                onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                  e.target.value = e.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9_]+/g, "_");
                },
              })}
            />
            <div className="text-[12px] text-muted-foreground mt-[4px]">
              {t(
                "El nombre solo puede tener letras en inglés (minúsculas), números y guiones bajos.",
              )}
            </div>
            <FieldError error={errors.name} />
          </label>

          <HeaderTypeField
            headerType={headerType}
            onHeaderType={(v) =>
              setValue("headerType", v, { shouldDirty: true })
            }
            headerText={headerText}
            onHeaderText={(v) => setValue("header", v, { shouldDirty: true })}
            headerVariable={headerVariable}
            onHeaderVariable={(v) =>
              setValue("headerVariable", v, { shouldDirty: true })
            }
            mediaUrl={mediaUrl}
            mediaName={mediaName}
            orgId={activeOrgId ?? undefined}
            onMedia={(url, name) => {
              setValue("mediaUrl", url, { shouldDirty: true });
              setValue("mediaName", name);
            }}
            onClearMedia={() => {
              setValue("mediaUrl", "");
              setValue("mediaName", "");
            }}
            dark={appDark}
          />

          <BodyField
            register={register}
            setValue={setValue}
            value={body}
            error={errors.body}
            dark={appDark}
          />

          <VariableMapper
            vars={varRows}
            onChange={(i, patch) => {
              const next = [...(bodyVariables || [])];
              const cur = next[i] || { value: "" };
              next[i] = {
                value: patch.sample !== undefined ? patch.sample : cur.value,
                field: patch.field !== undefined ? patch.field : cur.field,
              };
              setValue("bodyVariables", next, { shouldDirty: true });
            }}
          />

          <label>
            <div className="label">
              {t("Pie")} ({t("opcional")})
            </div>
            <input
              type="text"
              className="text"
              placeholder={t("Texto del pie")}
              maxLength={60}
              {...register("footer", {
                maxLength: { value: 60, message: t("Máximo 60 caracteres") },
              })}
            />
          </label>

          <TemplateButtonsField
            control={control}
            register={register}
            setValue={setValue}
            category={category}
          />
        </form>
      </SectionBody>

      <SectionFooter>
        {submitError && (
          <Alert
            type="error"
            showIcon
            closable={{ afterClose: () => setSubmitError(null) }}
            title={submitError}
            className="mb-[12px]"
          />
        )}
        <Button
          type="submit"
          form="template-form"
          invalid={
            !isValid ||
            !isDirty ||
            !bodyVarsComplete ||
            !headerVarComplete ||
            !mediaHeaderComplete
          }
          loading={isPending}
          className="primary"
        >
          {t("Enviar a revisión")}
        </Button>
      </SectionFooter>
    </>
  );
}
