import type { Control, FieldValues, Path } from "react-hook-form";
import { useTranslation } from "@/hooks/useTranslation";
import SectionField from "@/components/SectionField";
import TextAreaField from "@/components/TextAreaField";

type PersonaSectionProps<T extends FieldValues> = {
  control: Control<T>;
  disabled?: boolean;
};

/**
 * Per-agent identity (goal / tone / escalation policy). Stored at
 * `extra.persona.*`; the platform renders it into the root system prompt.
 * Company-wide facts live on the organization's business profile instead.
 *
 * `tone` is a textarea rather than the one-line input it started as: it is the
 * only field describing HOW to write, so a company with a real voice puts the
 * register, the things it never says, and a few example lines in here — and
 * none of that survives a single-line input.
 */
export default function PersonaSection<T extends FieldValues>({
  control,
  disabled,
}: PersonaSectionProps<T>) {
  const { translate: t } = useTranslation();

  return (
    <SectionField label={t("Agent role")} disabled={disabled}>
      <TextAreaField
        name={"extra.persona.goal" as Path<T>}
        control={control}
        label={t("Goal")}
        placeholder={t("Contact new leads and qualify them...")}
        disabled={disabled}
      />

      <TextAreaField
        name={"extra.persona.tone" as Path<T>}
        control={control}
        label={t("Tone")}
        placeholder={t("Friendly and professional")}
        disabled={disabled}
      />

      <TextAreaField
        name={"extra.persona.escalation_policy" as Path<T>}
        control={control}
        label={t("Escalation policy")}
        placeholder={t(
          "Hand off to a human if the customer asks or if you can't resolve it...",
        )}
        disabled={disabled}
      />
    </SectionField>
  );
}
