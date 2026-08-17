import { useTranslation } from "@/hooks/useTranslation";
import type { FieldOption, Scope, VarBinding } from "./types";
import SegmentBtn from "./SegmentBtn";

/** Editor for one template variable: code chip + scope label + static/field
 *  segmented control + the matching input/select.
 *
 *  Generic over the field id so each caller keeps its own vocabulary — a
 *  broadcast's contact-field enum, an automation's dotted paths — without this
 *  component knowing either. */
export default function VarCard<F extends string>({
  scope,
  num,
  value,
  example,
  fields,
  allowFallback = false,
  onUpdate,
}: {
  scope: Scope;
  num: string;
  value: VarBinding<F>;
  example?: string;
  fields: readonly FieldOption<F>[];
  /** Show a fallback input under the field select, for callers whose field can
   *  resolve to nothing at send time (see `VarBinding`). */
  allowFallback?: boolean;
  onUpdate: (patch: Partial<VarBinding<F>>) => void;
}) {
  const { translate: t } = useTranslation();
  const isField = value.mode === "field";
  return (
    <div
      className="rounded-[12px] p-[12px]"
      style={{
        background: "var(--background)",
        border: "1px solid var(--border)",
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-[8px] mb-[10px]">
        <div className="flex items-center gap-[8px]">
          <span
            className="text-[11px] px-[6px] py-[2px] rounded-full font-mono"
            style={{ background: "var(--muted)" }}
          >
            {`{{${num}}}`}
          </span>
          <span className="text-[12px] text-muted-foreground">
            {scope === "head" ? t("in header") : t("in body")}
          </span>
        </div>
        <div
          className="flex rounded-full p-[2px]"
          style={{ background: "var(--muted)" }}
        >
          <SegmentBtn
            active={!isField}
            onClick={() => onUpdate({ mode: "static" })}
          >
            {t("Fixed value")}
          </SegmentBtn>
          <SegmentBtn
            active={isField}
            onClick={() => onUpdate({ mode: "field" })}
          >
            {t("Per recipient")}
          </SegmentBtn>
        </div>
      </div>
      {isField ? (
        <>
          <select
            className="w-full text-[14px] rounded-[8px] p-[8px] outline-none"
            style={{
              background: "var(--background)",
              border: "1px solid var(--border)",
            }}
            value={value.field}
            onChange={(e) => onUpdate({ field: e.target.value as F })}
          >
            {fields.map((f) => (
              <option key={f.id} value={f.id}>
                {t(f.label)}
              </option>
            ))}
          </select>
          {allowFallback ? (
            <>
              <input
                type="text"
                className="w-full text-[13px] rounded-[8px] p-[8px] mt-[6px] outline-none"
                style={{
                  background: "var(--background)",
                  border: "1px solid var(--border)",
                }}
                placeholder={t("Fallback when the contact has no value")}
                value={value.fallback ?? ""}
                onChange={(e) => onUpdate({ fallback: e.target.value })}
              />
              <div className="text-[11px] mt-[6px] text-muted-foreground">
                {t(
                  "The contact's own value is used when there is one; otherwise the fallback — an empty fallback leaves a gap in the message.",
                )}
              </div>
            </>
          ) : (
            <div className="text-[11px] mt-[6px] text-muted-foreground">
              {t("Will be automatically substituted with the contact's value")}
            </div>
          )}
        </>
      ) : (
        <input
          type="text"
          className="w-full text-[14px] rounded-[8px] p-[8px] outline-none"
          style={{
            background: "var(--background)",
            border: "1px solid var(--border)",
          }}
          placeholder={example || t("Value for all recipients")}
          value={value.static}
          onChange={(e) => onUpdate({ static: e.target.value })}
        />
      )}
    </div>
  );
}
