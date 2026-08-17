/** One half of the "Fixed value / Per recipient" segmented control inside a
 *  VarCard. */
export default function SegmentBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-[12px] px-[10px] py-[3px] rounded-full border-none cursor-pointer whitespace-nowrap"
      style={{
        background: active ? "var(--background)" : "transparent",
        color: active ? "var(--foreground)" : "var(--muted-foreground)",
        boxShadow: active ? "0 1px 2px rgba(0,0,0,.06)" : "none",
      }}
    >
      {children}
    </button>
  );
}
