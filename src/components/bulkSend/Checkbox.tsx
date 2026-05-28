import { Check } from "lucide-react";

/** Square primary-tinted checkbox used in the recipient list. */
export default function Checkbox({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        onChange();
      }}
      className="inline-flex items-center justify-center rounded-[6px] shrink-0 transition-all"
      style={{
        width: 20,
        height: 20,
        background: checked ? "var(--primary)" : "var(--background)",
        border: `1.5px solid ${checked ? "var(--primary)" : "var(--input)"}`,
      }}
    >
      {checked && <Check className="w-[12px] h-[12px] text-white" strokeWidth={3} />}
    </button>
  );
}
