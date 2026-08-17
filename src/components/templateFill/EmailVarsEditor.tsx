import { AlertTriangle, Braces } from "lucide-react";

import { useTranslation } from "@/hooks/useTranslation";
import type { EmailTemplateVariable } from "@/supabase/client";
import { EMAIL_VAR_FIELDS } from "@/components/emailTemplate/VariablesTab";
import { auditVariables } from "@/components/emailTemplate/renderTemplate";

/**
 * Per-send fallback overrides, keyed by slot number. Absent = use the
 * template's stored fallback.
 *
 * Stored as an override map rather than a copy of the bindings on purpose: the
 * template row remains the single answer to "where does {{2}} come from", so
 * re-binding a slot in the builder takes effect everywhere, and an automation
 * configured months ago cannot go on sending a slot the template no longer has.
 */
export type EmailVarOverrides = Record<number, string>;

/** The template's bindings with this send's fallbacks applied — the array that
 *  gets snapshotted onto the message. */
export function applyEmailOverrides(
  variables: EmailTemplateVariable[],
  overrides: EmailVarOverrides,
): EmailTemplateVariable[] {
  return variables.map((v) =>
    overrides[v.n] === undefined ? v : { ...v, fallback: overrides[v.n] },
  );
}

/**
 * Slots that would render as an empty string for every recipient.
 *
 * A `custom` slot has no contact field by definition, so an empty fallback is
 * not a graceful degradation — it is a hole in every copy of the email. Those
 * block the send. A field-backed slot with an empty fallback only affects the
 * contacts missing that field, which the preview already flags in amber, so it
 * is left as a warning rather than a gate.
 */
export function unfilledEmailVars(
  variables: EmailTemplateVariable[],
  overrides: EmailVarOverrides,
): number[] {
  return applyEmailOverrides(variables, overrides)
    .filter((v) => v.field === "custom" && !v.fallback.trim())
    .map((v) => v.n);
}

/**
 * Confirm an email template's variable bindings and set this send's fallbacks.
 *
 * The WhatsApp editor ASKS what each `{{n}}` should draw from, because a
 * Meta-approved template is a fixed string with numbered holes and nothing
 * records an intent for them. An email template already stores that intent — the
 * builder is where you say "{{2}} is the first name" — so asking again here
 * would be a second, competing answer.
 *
 * What is genuinely per-send is the fallback: "Hi {{1}}" wants "there" on a
 * newsletter and "valued customer" on an invoice, and a `custom` slot is nothing
 * BUT its fallback. Shared by the bulk-send wizard and the automation editor's
 * send-email step, which need exactly the same thing.
 */
export default function EmailVarsEditor({
  variables,
  html,
  overrides,
  setOverrides,
  emptyLabel,
}: {
  variables: EmailTemplateVariable[];
  /** The compiled design, audited for slots placed with no binding. Pass
   *  `undefined` where the caller has not loaded it — the audit is then
   *  skipped rather than reporting every slot as missing. */
  html?: string;
  overrides: EmailVarOverrides;
  setOverrides: (next: EmailVarOverrides) => void;
  emptyLabel?: string;
}) {
  const { translate: t } = useTranslation();

  const sorted = [...variables].sort((a, b) => a.n - b.n);

  // Slots placed in the design with no binding render as literal `{{3}}` in a
  // real inbox, and bindings never placed are silently ignored. Both are
  // authoring mistakes, but this is the last screen before they reach someone.
  const audit =
    html === undefined
      ? { unplaced: [], undefinedSlots: [] }
      : auditVariables(html, variables);

  return (
    <>
      {audit.undefinedSlots.length > 0 && (
        <Warning>
          {t("These slots are in the design but have no variable:")}{" "}
          {audit.undefinedSlots.map((n) => `{{${n}}}`).join(", ")}.{" "}
          {t("They will be sent as-is.")}
        </Warning>
      )}

      {audit.unplaced.length > 0 && (
        <Warning>
          {t("These variables are defined but never used:")}{" "}
          {audit.unplaced.map((n) => `{{${n}}}`).join(", ")}.
        </Warning>
      )}

      {sorted.length === 0 && emptyLabel && (
        <div className="py-[20px] text-center text-muted-foreground text-[13px]">
          {emptyLabel}
        </div>
      )}

      <div className="flex flex-col gap-[8px]">
        {sorted.map((variable) => {
          const label =
            EMAIL_VAR_FIELDS.find((f) => f.value === variable.field)?.label ??
            variable.field;
          const isCustom = variable.field === "custom";
          const value =
            overrides[variable.n] === undefined
              ? variable.fallback
              : overrides[variable.n];
          const missing = isCustom && !value.trim();

          return (
            <div
              key={variable.n}
              className="rounded-[14px] p-[14px]"
              style={{
                background: "var(--background)",
                border: `1px solid ${
                  missing ? "var(--destructive)" : "var(--border)"
                }`,
              }}
            >
              <div className="flex items-center gap-[8px] mb-[8px]">
                <span className="inline-flex items-center gap-[4px] text-[12px] font-mono text-muted-foreground">
                  <Braces size={13} />
                  {`{{${variable.n}}}`}
                </span>
                <span className="text-[13px] font-semibold">{t(label)}</span>
                {!isCustom && (
                  <span className="ms-auto text-[11px] text-muted-foreground">
                    {t("per recipient")}
                  </span>
                )}
              </div>

              <input
                value={value}
                onChange={(e) =>
                  setOverrides({ ...overrides, [variable.n]: e.target.value })
                }
                placeholder={
                  isCustom
                    ? t("Value sent to everyone")
                    : t("Used when this contact has no value")
                }
                dir="auto"
                className="w-full rounded-[8px] px-[10px] py-[7px] text-[13px] outline-none"
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                }}
              />

              <div className="mt-[6px] text-[11px] text-muted-foreground">
                {isCustom
                  ? t("This slot has no contact field — everyone gets this.")
                  : t("Shown only when the contact's field is empty.")}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function Warning({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-[10px] flex gap-[9px] items-start rounded-[10px] bg-warning/10 p-[10px_12px] text-[12.5px] leading-[1.5]">
      <AlertTriangle size={14} className="mt-[2px] shrink-0 text-warning" />
      <div>{children}</div>
    </div>
  );
}
