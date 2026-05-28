import { useTranslation } from "@/hooks/useTranslation";
import { FIELD_OPTIONS, type ContactField, type Scope, type VarValue } from "./types";
import SegmentBtn from "./SegmentBtn";

/** Editor for one template variable: code chip + scope label + static/field
 *  segmented control + the matching input/select. */
export default function VarCard({
  scope,
  num,
  value,
  example,
  onUpdate,
}: {
  scope: Scope;
  num: string;
  value: VarValue;
  example?: string;
  onUpdate: (patch: Partial<VarValue>) => void;
}) {
  const { translate: t } = useTranslation();
  const isField = value.mode === "field";
  return (
    <div
      className="rounded-[12px] p-[12px]"
      style={{ background: "var(--background)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-center justify-between mb-[10px]">
        <div className="flex items-center gap-[8px]">
          <span
            className="text-[11px] px-[6px] py-[2px] rounded-full font-mono"
            style={{ background: "var(--muted)" }}
          >
            {`{{${num}}}`}
          </span>
          <span className="text-[12px] text-muted-foreground">
            {scope === "head" ? t("en encabezado") : t("en cuerpo")}
          </span>
        </div>
        <div className="flex rounded-full p-[2px]" style={{ background: "var(--muted)" }}>
          <SegmentBtn active={!isField} onClick={() => onUpdate({ mode: "static" })}>
            {t("Valor fijo")}
          </SegmentBtn>
          <SegmentBtn active={isField} onClick={() => onUpdate({ mode: "field" })}>
            {t("Por destinatario")}
          </SegmentBtn>
        </div>
      </div>
      {isField ? (
        <>
          <select
            className="w-full text-[14px] rounded-[8px] p-[8px] outline-none"
            style={{ background: "var(--background)", border: "1px solid var(--border)" }}
            value={value.field}
            onChange={(e) => onUpdate({ field: e.target.value as ContactField })}
          >
            {FIELD_OPTIONS.map((f) => (
              <option key={f.id} value={f.id}>
                {t(f.label)}
              </option>
            ))}
          </select>
          <div className="text-[11px] mt-[6px] text-muted-foreground">
            {t("Se sustituirá automáticamente con el valor del contacto")}
          </div>
        </>
      ) : (
        <input
          type="text"
          className="w-full text-[14px] rounded-[8px] p-[8px] outline-none"
          style={{ background: "var(--background)", border: "1px solid var(--border)" }}
          placeholder={example || t("Valor para todos los destinatarios")}
          value={value.static}
          onChange={(e) => onUpdate({ static: e.target.value })}
        />
      )}
    </div>
  );
}
