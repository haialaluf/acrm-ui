import type {
  Control,
  FieldValues,
  Path,
  UseFormRegister,
} from "react-hook-form";
import { useTranslation } from "@/hooks/useTranslation";
import SectionField from "@/components/SectionField";
import TextAreaField from "@/components/TextAreaField";

type PersonaSectionProps<T extends FieldValues> = {
  control: Control<T>;
  register: UseFormRegister<T>;
  disabled?: boolean;
};

/**
 * Per-agent identity (goal / tone / escalation policy). Stored at
 * `extra.persona.*`; the platform renders it into the root system prompt.
 * Company-wide facts live on the organization's business profile instead.
 */
export default function PersonaSection<T extends FieldValues>({
  control,
  register,
  disabled,
}: PersonaSectionProps<T>) {
  const { translate: t } = useTranslation();

  return (
    <SectionField label={t("Rol del agente")} disabled={disabled}>
      <TextAreaField
        name={"extra.persona.goal" as Path<T>}
        control={control}
        label={t("Objetivo")}
        placeholder={t("Contactar nuevos leads y calificarlos...")}
        disabled={disabled}
      />

      <label>
        <div className="label">{t("Tono")}</div>
        <input
          type="text"
          className="text"
          placeholder={t("Cercano y profesional")}
          disabled={disabled}
          {...register("extra.persona.tone" as Path<T>)}
        />
      </label>

      <TextAreaField
        name={"extra.persona.escalation_policy" as Path<T>}
        control={control}
        label={t("Política de escalamiento")}
        placeholder={t(
          "Deriva a un humano si el cliente lo pide o si no puedes resolver...",
        )}
        disabled={disabled}
      />
    </SectionField>
  );
}
