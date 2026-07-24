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

  return <div className="text-destructive text-[11.5px]">{t(message)}</div>;
}
