/** A boxed stat (big number + label), shown in the sending/done wizard stages
 *  and, interactively, on the broadcast batch detail page. `onClick` is
 *  optional so existing (non-interactive) callers are unaffected. */
export default function StatTile({
  label,
  value,
  color,
  onClick,
  active,
}: {
  label: string;
  value: number;
  color: string;
  onClick?: () => void;
  active?: boolean;
}) {
  const interactive = !!onClick;
  return (
    <div
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") onClick?.();
            }
          : undefined
      }
      className={
        "rounded-[12px] p-[12px] text-center " +
        (interactive ? "cursor-pointer hover:bg-accent " : "") +
        (active ? "ring-2 ring-primary " : "")
      }
      style={{
        background: "var(--background)",
        border: "1px solid var(--border)",
      }}
    >
      <div className="text-[22px] font-semibold" style={{ color }}>
        {value}
      </div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}
