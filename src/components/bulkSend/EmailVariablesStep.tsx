import { ArrowLeft } from "lucide-react";

import Button from "@/components/Button";
import SectionFooter from "@/components/SectionFooter";
import EmailVarsEditor from "@/components/templateFill/EmailVarsEditor";
import { useTranslation } from "@/hooks/useTranslation";
import type { EmailTemplateRow } from "@/supabase/client";

import { type EmailVarOverrides, unfilledEmailVars } from "./types";

/**
 * Step 3, email — confirm the template's variable bindings and set this send's
 * fallbacks.
 *
 * A sibling of `VariablesStep` rather than a branch inside it, for the reason
 * `EmailTemplatesList` is a sibling of `TemplatesList`: the two share a shell
 * and nothing else. Why email confirms where WhatsApp collects is explained on
 * `EmailVarsEditor`, which is the whole body of this step and is shared with the
 * automation editor's send-email step.
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

  const unfilled = unfilledEmailVars(template.variables, overrides);

  return (
    <>
      <div className="grow overflow-y-auto px-[16px] pt-[8px] pb-[12px]">
        <EmailVarsEditor
          variables={template.variables}
          html={template.html ?? ""}
          overrides={overrides}
          setOverrides={setOverrides}
          emptyLabel={t("This template has no variables — nothing to fill in.")}
        />
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
