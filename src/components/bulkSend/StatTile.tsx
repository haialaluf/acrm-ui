/** A boxed stat (big number + label), shown in the sending and done stages. */
export default function StatTile({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div
      className="rounded-[12px] p-[12px] text-center"
      style={{ background: "var(--background)", border: "1px solid var(--border)" }}
    >
      <div className="text-[22px] font-semibold" style={{ color }}>
        {value}
      </div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}
