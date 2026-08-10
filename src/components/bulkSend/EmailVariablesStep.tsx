import { AlertTriangle, ArrowLeft, Braces } from "lucide-react";

import Button from "@/components/Button";
import SectionFooter from "@/components/SectionFooter";
import { useTranslation } from "@/hooks/useTranslation";
import type { EmailTemplateRow } from "@/supabase/client";
import { EMAIL_VAR_FIELDS } from "@/components/emailTemplate/VariablesTab";
import { auditVariables } from "@/components/emailTemplate/renderTemplate";

import { type EmailVarOverrides, unfilledEmailVars } from "./types";

/**
 * Step 3, email — confirm the template's variable bindings and set this send's
 * fallbacks.
 *
 * A sibling of `VariablesStep` rather than a branch inside it, for the reason
 * `EmailTemplatesList` is a sibling of `TemplatesList`: the two share a shell
 * and nothing else. The WhatsApp step ASKS what each `{{n}}` should draw from,
 * because a Meta-approved template is a fixed string with numbered holes and
 * nothing records an intent for them. An email template already stores that
 * intent — the builder is where you say "{{2}} is the first name" — so asking
 * again here would be a second, competing answer.
 *
 * What is genuinely per-send is the fallback: "Hi {{1}}" wants "there" on a
 * newsletter and "valued customer" on an invoice, and a `custom` slot is
 * nothing BUT its fallback.
 */
export default function EmailVariablesStep({
  template,
  overrides,
  setOverrides,
  onNext,
}: {
  template: EmailTemplateRow;
  overrides: EmailVarOverrides;
  setOverrides: (next: EmailVarOverrides) => void;
  onNext: () => void;
}) {
  const { translate: t } = useTranslation();

  const variables = [...template.variables].sort((a, b) => a.n - b.n);
  const unfilled = unfilledEmailVars(template.variables, overrides);

  // Slots placed in the design with no binding render as literal `{{3}}` in a
  // real inbox, and bindings never placed are silently ignored. Both are
  // authoring mistakes, but this is the last screen before they reach someone.
  const { unplaced, undefinedSlots } = auditVariables(
    template.html ?? "",
    template.variables,
  );

  const fallbackOf = (n: number, stored: string) =>
    overrides[n] === undefined ? stored : overrides[n];

  return (
    <>
      <div className="grow overflow-y-auto px-[16px] pt-[8px] pb-[12px]">
        {undefinedSlots.length > 0 && (
          <Warning>
            {t("These slots are in the design but have no variable:")}{" "}
            {undefinedSlots.map((n) => `{{${n}}}`).join(", ")}.{" "}
            {t("They will be sent as-is.")}
          </Warning>
        )}

        {unplaced.length > 0 && (
          <Warning>
            {t("These variables are defined but never used:")}{" "}
            {unplaced.map((n) => `{{${n}}}`).join(", ")}.
          </Warning>
        )}

        {variables.length === 0 && (
          <div className="py-[40px] text-center text-muted-foreground text-[14px]">
            {t("This template has no variables — nothing to fill in.")}
          </div>
        )}

        <div className="flex flex-col gap-[8px]">
          {variables.map((variable) => {
            const label =
              EMAIL_VAR_FIELDS.find((f) => f.value === variable.field)?.label ??
              variable.field;
            const isCustom = variable.field === "custom";
            const value = fallbackOf(variable.n, variable.fallback);
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
                  <span className="text-[13px] font-semibold">{label}</span>
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
      </div>

      <SectionFooter>
        {unfilled.length > 0 && (
          <div className="mb-[8px] text-[12px] text-destructive-strong">
            {t("Fill in")} {unfilled.map((n) => `{{${n}}}`).join(", ")} —{" "}
            {t("a custom slot left empty is a gap in every copy.")}
          </div>
        )}
        <Button
          className="primary"
          onClick={onNext}
          invalid={unfilled.length > 0}
        >
          <span className="inline-flex items-center justify-center gap-[8px]">
            {t("Preview and send")}
            <ArrowLeft className="w-[16px] h-[16px] rotate-180" />
          </span>
        </Button>
      </SectionFooter>
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
