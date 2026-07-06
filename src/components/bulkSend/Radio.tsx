/** Circular radio indicator used in the "send now / later" picker. Pure
 *  display — the parent button handles the click. */
export default function Radio({ checked }: { checked: boolean }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-full shrink-0"
      style={{
        width: 18,
        height: 18,
        border: `2px solid ${checked ? "var(--primary)" : "var(--input)"}`,
        background: "var(--background)",
        transition: "border-color .12s ease",
      }}
    >
      {checked && (
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: 999,
            background: "var(--primary)",
          }}
        />
      )}
    </span>
  );
}
