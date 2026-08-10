import { useTranslation } from "@/hooks/useTranslation";
import { emailSuggestion } from "@/utils/emailValidation";

/**
 * "Did you mean @gmail.com?" under an email field.
 *
 * Advice, not validation — deliberately outside `FieldError` and outside the
 * form's validity, because we are guessing. `gmial.com` is a registered domain
 * with working MX records, so no automated check can prove it wrong; only the
 * person who typed it knows. Blocking the save, or silently rewriting the
 * address, would both be worse than asking.
 *
 * Renders nothing unless the domain is a known near-miss.
 */
export default function EmailSuggestion({
  value,
}: {
  value: string | null | undefined;
}) {
  const { translate: t } = useTranslation();
  const suggestion = emailSuggestion(value);

  if (!suggestion) return null;

  return (
    <div className="text-warning-strong text-[11.5px]">
      {t("Did you mean")} <span dir="ltr">@{suggestion}</span>?
    </div>
  );
}
