import { useRef } from "react";
import type {
  FieldError as RHFFieldError,
  UseFormRegister,
  UseFormSetValue,
} from "react-hook-form";
import { useTranslation } from "@/hooks/useTranslation";
import { isRtl, type Language } from "@/stores/uiSlice";
import type { TemplateFormData } from "@/components/templateEditorTypes";
import { getVarNumbers } from "@/components/templateVars";
import FormatToolbar from "./FormatToolbar";
import { insertAtCursor } from "./formatHelpers";

function useLengthState() {
  const { translate: t } = useTranslation();
  return (len: number): { cls: string; text: string } | null => {
    if (len === 0) return null;
    if (len <= 250)
      return { cls: "good", text: t("Good length — fits on one screen") };
    if (len <= 600)
      return {
        cls: "warn",
        text: t("Getting long — WhatsApp may add “Read more”"),
      };
    return {
      cls: "over",
      text: t("Very long — most people won't read it all"),
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
  const { translate: t, currentLanguage } = useTranslation();
  const uiRtl = isRtl(currentLanguage as Language);
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);
  const lengthState = useLengthState();
  const lg = lengthState(value.length);

  const setBody = (v: string) =>
    setValue("body", v, { shouldDirty: true, shouldValidate: true });

  const { ref: rhfRef, ...bodyReg } = register("body", {
    required: "The body is required",
    maxLength: { value: 1024, message: "Maximum 1024 characters" },
    validate: (v: string) => {
      const trimmed = v.trim();
      if (/^\{\{\d+\}\}/.test(trimmed))
        return "The body cannot start with a variable";
      if (/\{\{\d+\}\}$/.test(trimmed))
        return "The body cannot end with a variable";
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
        <span className="label !mb-0">{t("Body")}</span>
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
        dir={value.trim() ? "auto" : uiRtl ? "rtl" : "ltr"}
        placeholder={t(
          "Write your message. Select text and use the toolbar above to make it bold, add emoji, or insert a variable.",
        )}
      />

      <div className="flex items-center justify-between gap-[8px] mt-[8px] flex-wrap min-h-[26px]">
        {error ? (
          <span className="text-destructive text-[11.5px] leading-[1.5]">
            {t(error.message ?? "The body is required")}
          </span>
        ) : (
          <span className="hint">{t("The body is required")}</span>
        )}
        {lg && (
          <span className={"len-chip " + lg.cls}>
            <span className="dot" />
            {lg.text}
          </span>
        )}
      </div>
    </div>
  );
}
