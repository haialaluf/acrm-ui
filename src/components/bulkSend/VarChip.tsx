import { useTranslation } from "@/hooks/useTranslation";
import { FIELD_OPTIONS, type VarValue } from "./types";

/** Inline pill rendered in place of `{{N}}` inside the live preview card on
 *  the variables stage. Primary-tinted when the variable resolves per-recipient,
 *  success-tinted when a static value is filled, muted when empty. */
export default function VarChip({
  value,
  placeholder,
}: {
  value: VarValue | undefined;
  placeholder: string;
}) {
  const { translate: t } = useTranslation();
  if (!value) {
    return (
      <span
        className="inline-flex items-center rounded-full mx-[2px] align-baseline text-[13px]"
        style={{
          background: "var(--muted)",
          color: "var(--muted-foreground)",
          border: "1px solid var(--border)",
          padding: "1px 10px",
          lineHeight: "20px",
        }}
      >
        {placeholder}
      </span>
    );
  }
  const isField = value.mode === "field";
  const label = isField
    ? t(FIELD_OPTIONS.find((f) => f.id === value.field)?.label || "")
    : value.static;
  const empty = !isField && !label;
  return (
    <span
      className="inline-flex items-center rounded-full mx-[2px] align-baseline text-[13px]"
      style={{
        background: isField
          ? "oklch(from var(--primary) l c h / 0.10)"
          : empty
            ? "var(--muted)"
            : "oklch(from var(--success) l c h / 0.10)",
        color: isField
          ? "var(--primary)"
          : empty
            ? "var(--muted-foreground)"
            : "oklch(from var(--success) calc(l - 0.15) c h)",
        border: `1px solid ${
          isField
            ? "oklch(from var(--primary) l c h / 0.35)"
            : empty
              ? "var(--border)"
              : "oklch(from var(--success) l c h / 0.35)"
        }`,
        padding: "1px 10px",
        lineHeight: "20px",
      }}
    >
      {label || placeholder}
    </span>
  );
}
