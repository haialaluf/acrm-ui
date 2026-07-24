import { useRef } from "react";
import type {
  FieldError as RHFFieldError,
  UseFormRegister,
  UseFormSetValue,
} from "react-hook-form";
import { useTranslation } from "@/hooks/useTranslation";
import FieldError from "@/components/FieldError";
import type { TemplateFormData } from "@/components/templateEditorTypes";
import { getVarNumbers } from "@/components/templateVars";
import FormatToolbar from "./FormatToolbar";
import { insertAtCursor } from "./formatHelpers";

function useLengthState() {
  const { translate: t } = useTranslation();
  return (len: number): { cls: string; text: string } | null => {
    if (len === 0) return null;
    if (len <= 250)
      return { cls: "good", text: t("Buena longitud — entra en una pantalla") };
    if (len <= 600)
      return {
        cls: "warn",
        text: t("Se está haciendo largo — WhatsApp puede agregar “Leer más”"),
      };
    return {
      cls: "over",
      text: t("Muy largo — la mayoría no lo va a leer completo"),
    };
  };
}

/** Body editor: formatting toolbar + textarea + live length guidance. Keeps
    react-hook-form validation (required, max length, no leading/trailing var)
    while letting the toolbar mutate the value programmatically. */
export default function BodyField({
  register,
  setValue,
  value,
  error,
  dark,
}: {
  register: UseFormRegister<TemplateFormData>;
  setValue: UseFormSetValue<TemplateFormData>;
  value: string;
  error?: RHFFieldError;
  dark?: boolean;
}) {
  const { translate: t } = useTranslation();
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);
  const lengthState = useLengthState();
  const lg = lengthState(value.length);

  const setBody = (v: string) =>
    setValue("body", v, { shouldDirty: true, shouldValidate: true });

  const { ref: rhfRef, ...bodyReg } = register("body", {
    required: "El cuerpo es obligatorio",
    maxLength: { value: 1024, message: "Máximo 1024 caracteres" },
    validate: (v: string) => {
      const trimmed = v.trim();
      if (/^\{\{\d+\}\}/.test(trimmed))
        return "El cuerpo no puede empezar con una variable";
      if (/\{\{\d+\}\}$/.test(trimmed))
        return "El cuerpo no puede terminar con una variable";
      return true;
    },
  });

  function insertVariable() {
    const nums = getVarNumbers(value);
    const next = nums.length ? Math.max(...nums) + 1 : 1;
    insertAtCursor(bodyRef.current, value, setBody, `{{${next}}}`, true);
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-baseline justify-between mb-[8px]">
        <span className="label !mb-0">{t("Cuerpo")}</span>
        <span className="text-[11px] text-muted-foreground">
          {value.length}/1024
        </span>
      </div>

      <FormatToolbar
        targetRef={bodyRef}
        value={value}
        setValue={setBody}
        onVariable={insertVariable}
        dark={dark}
        features={{ format: true, emoji: true, variable: true }}
      />

      <textarea
        {...bodyReg}
        ref={(e) => {
          rhfRef(e);
          bodyRef.current = e;
        }}
        className="body-area"
        rows={7}
        maxLength={1024}
        dir="auto"
        placeholder={t(
          "Escribí tu mensaje. Seleccioná texto y usá la barra de arriba para poner negrita, agregar emoji o insertar una variable.",
        )}
      />

      <div className="flex items-center justify-between gap-[8px] mt-[8px] flex-wrap">
        <span className="text-[12px] text-muted-foreground">
          {t("El cuerpo es obligatorio")}
        </span>
        {lg && (
          <span className={"len-chip " + lg.cls}>
            <span className="dot" />
            {lg.text}
          </span>
        )}
      </div>
      <FieldError error={error} />
    </div>
  );
}
