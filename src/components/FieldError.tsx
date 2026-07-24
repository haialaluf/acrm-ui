import type { FieldError as RHFFieldError } from "react-hook-form";
import { useTranslation } from "@/hooks/useTranslation";

export default function FieldError({
  error,
}: {
  error?: RHFFieldError | string;
}) {
  const { translate: t } = useTranslation();
  const message = typeof error === "string" ? error : error?.message;
  if (!message) return null;
  // Messages are stored as translation keys (untranslated at validation time),
  // so translate here at render time — this keeps them in sync with the current
  // language instead of freezing the language active when validation last ran.
  return <div className="text-destructive text-[12px]">{t(message)}</div>;
}
