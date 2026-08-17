import EmailPreviewFrame from "@/components/emailTemplate/EmailPreviewFrame";
import EmailVarsEditor, {
  applyEmailOverrides,
  unfilledEmailVars,
} from "@/components/templateFill/EmailVarsEditor";
import { useTranslation } from "@/hooks/useTranslation";
import {
  useEmailTemplate,
  useEmailTemplates,
} from "@/queries/useEmailTemplates";
import type { EmailStep, EmailTemplateExtra } from "@/supabase/client";

import { Field, selectClass } from "./Fields";

/**
 * The send-email step's settings: pick a template, set this step's fallbacks,
 * see the compiled email.
 *
 * Same split as the bulk-send wizard, and the same components: an email
 * template already records which field each `{{n}}` draws from, so there is
 * nothing to bind here — only the fallback each slot uses for a contact with
 * nothing of its own, which genuinely belongs to the step.
 */
export default function EmailStepFields({
  step,
  onChange,
}: {
  step: EmailStep;
  onChange: (step: EmailStep) => void;
}) {
  const { translate: t } = useTranslation();
  const { data: templates } = useEmailTemplates();
  // The list endpoint omits `html`, and both the preview and the placed-slot
  // audit need the compiled design, so the chosen one is fetched in full.
  const { data: template } = useEmailTemplate(
    step.emailTemplateId || undefined,
  );

  const unfilled = template
    ? unfilledEmailVars(template.variables, step.fallbacks ?? {})
    : [];

  return (
    <>
      <Field label={t("Email template")}>
        <select
          className={selectClass}
          value={step.emailTemplateId}
          onChange={(e) =>
            // Fallbacks are keyed by slot number, which means something
            // different in every template.
            onChange({
              ...step,
              emailTemplateId: e.target.value,
              fallbacks: undefined,
            })
          }
        >
          <option value="">{t("Choose an email…")}</option>
          {(templates ?? []).map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </select>
        {(templates ?? []).length === 0 && (
          <div className="mt-[6px] text-xs text-muted-foreground">
            {t("No email templates in this organization yet.")}
          </div>
        )}
      </Field>

      {template && template.variables.length > 0 && (
        <Field
          label={t("Variables")}
          hint={t(
            "Where each slot draws from is set in the email builder. What you set here is the fallback used when the contact has no value of its own.",
          )}
        >
          <EmailVarsEditor
            variables={template.variables}
            html={template.html ?? ""}
            overrides={step.fallbacks ?? {}}
            setOverrides={(fallbacks) => onChange({ ...step, fallbacks })}
          />
          {unfilled.length > 0 && (
            <div className="mt-[8px] text-[12px] text-destructive-strong">
              {t("Fill in")} {unfilled.map((n) => `{{${n}}}`).join(", ")} —{" "}
              {t("a custom slot left empty is a gap in every copy.")}
            </div>
          )}
        </Field>
      )}

      {template && (
        <Field
          label={t("Preview")}
          hint={t(
            "Shown with the fallbacks above; each contact's own values are substituted when the step runs.",
          )}
        >
          <div className="overflow-hidden rounded-[10px] border border-border">
            <EmailPreviewFrame
              html={template.html ?? ""}
              subject={template.subject}
              preheader={template.preheader}
              variables={applyEmailOverrides(
                template.variables,
                step.fallbacks ?? {},
              )}
              dir={(template.extra as EmailTemplateExtra | null)?.dir ?? "ltr"}
              className="h-[320px]"
            />
          </div>
        </Field>
      )}
    </>
  );
}
