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
  headerMediaFormat,
  slotKey,
  templateSlots,
  type FieldOption,
  type Scope,
  type VarBinding,
} from "@/components/templateFill/types";
import { useTranslation } from "@/hooks/useTranslation";
import { useSignedMediaUrl } from "@/hooks/useSignedMediaUrl";
import { useApprovedTemplates } from "@/queries/useAutomations";
import type {
  TemplateData,
  TemplateStep,
  TemplateVariable,
} from "@/supabase/client";

import { Field, selectClass } from "./Fields";

/**
 * The send-template step's settings: pick an approved template, fill its
 * header media and its `{{n}}` slots, see what the message will look like.
 *
 * The editor and the preview are the bulk-send wizard's own
 * (`components/templateFill`), minus the wizard: the same template asks for the
 * same things in the same cards whether you are sending it once to a list or
 * wiring it into a flow. Only the vocabulary differs — see `AUTOMATION_FIELDS`.
 */

/**
 * Contact fields a placeholder can draw from.
 *
 * Dotted paths, resolved by the engine through the same field resolver the
 * predicates use — unlike a broadcast, which resolves against a contact row the
 * browser already holds. The labels are the wizard's, so "Phone" means the same
 * thing on both screens even though the paths behind them differ.
 */
const AUTOMATION_FIELDS: FieldOption<string>[] = [
  { id: "contact.name", label: "Name" },
  { id: "contact.surname", label: "Last name" },
  { id: "contact.email", label: "Email" },
  { id: "conversation.contact_address", label: "Phone" },
];

/** The step stores a flat list of bindings; the shared cards want a map keyed
 *  by slot. `field` set means "per contact, with `value` as the fallback";
 *  `field` absent means "this literal for everyone". */
function toBindings(
  variables: TemplateVariable[] = [],
): Record<string, VarBinding<string>> {
  const out: Record<string, VarBinding<string>> = {};
  for (const v of variables) {
    out[slotKey(v.scope, v.n)] = v.field
      ? { mode: "field", field: v.field, fallback: v.value }
      : { mode: "static", static: v.value ?? "" };
  }
  return out;
}

function toVariable(
  scope: Scope,
  n: number,
  binding: VarBinding<string>,
): TemplateVariable {
  return binding.mode === "field"
    ? {
        scope,
        n,
        field: binding.field,
        ...(binding.fallback && { value: binding.fallback }),
      }
    : { scope, n, value: binding.static };
}

export default function TemplateStepFields({
  step,
  onChange,
}: {
  step: TemplateStep;
  onChange: (step: TemplateStep) => void;
}) {
  const { translate: t } = useTranslation();
  const { data: templates } = useApprovedTemplates();

  const row = (templates ?? []).find((x) => x.id === step.templateId);
  const components = (row?.components ?? []) as TemplateData["components"];
  const bindings = toBindings(step.variables);
  const media = headerMediaFormat(components);
  const intro = row ? varsIntro(components, t) : null;
  const headerMediaPreviewUrl = useSignedMediaUrl(step.headerMedia);

  const setBinding = (
    scope: Scope,
    n: number,
    patch: Partial<VarBinding<string>>,
  ) => {
    const next = applyBindingPatch(
      bindings[slotKey(scope, n)],
      patch,
      AUTOMATION_FIELDS,
    );
    onChange({
      ...step,
      variables: [
        ...(step.variables ?? []).filter(
          (v) => !(v.scope === scope && v.n === n),
        ),
        toVariable(scope, n, next),
      ].sort((a, b) => a.scope.localeCompare(b.scope) || a.n - b.n),
    });
  };

  return (
    <>
      <Field label={t("Template")}>
        <select
          className={selectClass}
          value={step.templateId}
          onChange={(e) =>
            // Bindings are positional, so they mean nothing against a different
            // template. Cleared rather than carried over — and so is the header
            // file, which the new template may not even accept.
            onChange({
              ...step,
              templateId: e.target.value,
              variables: [],
              headerMedia: undefined,
            })
          }
        >
          <option value="">{t("Choose a template…")}</option>
          {(templates ?? []).map((x) => (
            <option key={x.id} value={x.id}>
              {x.name} · {x.language}
            </option>
          ))}
        </select>
        {(templates ?? []).length === 0 && (
          <div className="mt-[6px] text-xs text-muted-foreground">
            {t("No approved templates in this organization yet.")}
          </div>
        )}
      </Field>

      {row && (
        <>
          {(templateSlots(components).length > 0 || media) && (
            <Field label={t("Variables")} hint={intro ?? undefined}>
              <TemplateVarsEditor<string>
                components={components}
                bindings={bindings}
                fields={AUTOMATION_FIELDS}
                // An automation resolves per contact, months after this was
                // configured, so every per-contact slot needs something to fall
                // back on. A broadcast previews the real values first and does
                // not.
                allowFallback
                onUpdate={setBinding}
                media={{
                  value: step.headerMedia ?? "",
                  name: step.headerMediaName ?? "",
                  note: t(
                    "The same file is sent to every contact who reaches this step.",
                  ),
                  onChange: (url, name) =>
                    onChange({
                      ...step,
                      headerMedia: url || undefined,
                      headerMediaName: name || undefined,
                    }),
                }}
              />
            </Field>
          )}

          <Field label={t("Preview")}>
            {/* The same bubble the broadcast wizard shows, with each binding
                highlighted where its {{n}} sits — an automation has no contact
                to resolve against until it runs. */}
            <div className="overflow-hidden rounded-[10px]">
              <WhatsAppPreview
                variant="bubble"
                data={templatePreviewData({
                  components,
                  values: bindingPreviewValues({
                    components,
                    bindings,
                    fields: AUTOMATION_FIELDS,
                    t,
                  }),
                  language: row.language,
                  media: {
                    url: headerMediaPreviewUrl ?? "",
                    name: step.headerMediaName ?? "",
                  },
                  copyCodeLabel: t("Copy code"),
                })}
              />
            </div>
          </Field>
        </>
      )}
    </>
  );
}
