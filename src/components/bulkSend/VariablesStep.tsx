import { ArrowLeft } from "lucide-react";

import Button from "@/components/Button";
import SectionFooter from "@/components/SectionFooter";
import { useTranslation } from "@/hooks/useTranslation";
import { type TemplateData } from "@/supabase/client";

import VarCard from "./VarCard";
import VarChip from "./VarChip";
import {
  countVars,
  type ContactField,
  type Scope,
  type VarValue,
} from "./types";

/** Step 3 — for each `{{N}}`, choose a static value or a per-recipient field.
 *  A live preview card at the top renders the template text with chips in
 *  place of each variable so changes are visible inline. */
export default function VariablesStep({
  template,
  vars,
  setVars,
  onNext,
}: {
  template: TemplateData;
  vars: Record<string, VarValue>;
  setVars: (v: Record<string, VarValue>) => void;
  onNext: () => void;
}) {
  const { translate: t } = useTranslation();
  const head = template.components.find((c) => c.type === "HEADER");
  const body = template.components.find((c) => c.type === "BODY");
  const foot = template.components.find((c) => c.type === "FOOTER");
  const headExamples = head?.example?.header_text || [];
  const bodyExamples = body?.example?.body_text?.[0] || [];

  const keys = Object.keys(vars);
  const hasVars = keys.length > 0;

  function update(key: string, patch: Partial<VarValue>) {
    const current = vars[key];
    const next: VarValue =
      patch.mode === "static" ||
      (patch.mode === undefined && current.mode === "static")
        ? {
            mode: "static",
            static:
              (patch as { static?: string }).static ??
              (current.mode === "static" ? current.static : ""),
          }
        : {
            mode: "field",
            field:
              (patch as { field?: ContactField }).field ??
              (current.mode === "field" ? current.field : "name"),
          };
    setVars({ ...vars, [key]: next });
  }

  const allFilled = Object.values(vars).every(
    (v) =>
      v.mode === "field" || (v.mode === "static" && v.static.trim() !== ""),
  );

  function renderWithChips(
    text: string | undefined,
    scope: Scope,
    examples: string[],
  ) {
    if (!text) return null;
    const parts = text.split(/(\{\{\d+\}\})/);
    return parts.map((p, i) => {
      const m = p.match(/^\{\{(\d+)\}\}$/);
      if (m) {
        const n = Number(m[1]);
        const v = vars[`${scope}.${n}`];
        return (
          <VarChip
            key={i}
            value={v}
            placeholder={examples[n - 1] || `{{${n}}}`}
          />
        );
      }
      return <span key={i}>{p}</span>;
    });
  }

  return (
    <>
      <div className="grow overflow-y-auto">
        <div className="px-[16px] pt-[14px] pb-[8px]">
          {hasVars && (
            <div className="text-[12px] mb-[12px] text-muted-foreground">
              {t(
                "Para cada variable, elige un valor fijo o un campo del contacto que se sustituirá por destinatario.",
              )}
            </div>
          )}
          <div
            className="rounded-[14px] p-[14px] text-[14px] leading-[22px]"
            style={{
              background: "var(--background)",
              border: "1px solid var(--border)",
              whiteSpace: "pre-wrap",
            }}
          >
            {head?.text && (
              <div className="font-semibold mb-[8px]">
                {countVars(head.text) > 0
                  ? renderWithChips(head.text, "head", headExamples)
                  : head.text}
              </div>
            )}
            {body?.text && (
              <div>
                {countVars(body.text) > 0
                  ? renderWithChips(body.text, "body", bodyExamples)
                  : body.text}
              </div>
            )}
            {foot?.text && (
              <div
                className="mt-[10px] text-[12px] italic"
                style={{ color: "var(--muted-foreground)" }}
              >
                {foot.text}
              </div>
            )}
          </div>
        </div>

        <div className="px-[16px] pb-[16px] flex flex-col gap-[8px] mt-[8px]">
          {keys.map((key) => {
            const [scope, n] = key.split(".");
            const example =
              scope === "head"
                ? headExamples[Number(n) - 1]
                : bodyExamples[Number(n) - 1];
            return (
              <VarCard
                key={key}
                scope={scope as Scope}
                num={n}
                value={vars[key]}
                example={example}
                onUpdate={(patch) => update(key, patch)}
              />
            );
          })}
          {!hasVars && (
            <div
              className="rounded-[12px] p-[16px] text-[13px] text-center text-muted-foreground"
              style={{
                background: "var(--background)",
                border: "1px dashed var(--border)",
              }}
            >
              {t("Esta plantilla no tiene variables — puedes continuar")}
            </div>
          )}
        </div>
      </div>

      <SectionFooter>
        <Button className="primary" onClick={onNext} invalid={!allFilled}>
          <span className="inline-flex items-center justify-center gap-[8px]">
            {t("Vista previa y envío")}
            <ArrowLeft className="w-[16px] h-[16px] rotate-180" />
          </span>
        </Button>
      </SectionFooter>
    </>
  );
}
