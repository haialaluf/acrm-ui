import type { ReactNode } from "react";
import { useTranslation } from "@/hooks/useTranslation";

function LinkBtn({
  onClick,
  children,
}: {
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-[12px] text-primary bg-transparent border-none p-0 cursor-pointer"
    >
      {children}
    </button>
  );
}

/** The row above a `ContactList`: how many rows the filter left, how many are
 *  selected, and the select-all / clear-all shortcuts. */
export default function ContactListToolbar({
  count,
  label,
  selectedCount,
  onSelectAll,
  onClearAll,
  children,
}: {
  count: number;
  /** Already-translated plural noun for a row — "contacts", "recipients". */
  label: string;
  selectedCount?: number;
  /** Omitted once everything selectable is already selected. */
  onSelectAll?: () => void;
  onClearAll?: () => void;
  children?: ReactNode;
}) {
  const { translate: t } = useTranslation();

  return (
    <div className="px-[18px] py-[8px] flex items-center justify-between gap-[12px] text-[12px] text-muted-foreground">
      <span className="truncate">
        {count} {label}
        {!!selectedCount && ` · ${selectedCount} ${t("selected")}`}
      </span>
      <div className="flex items-center gap-[12px] shrink-0">
        {onSelectAll && (
          <LinkBtn onClick={onSelectAll}>{t("Select all")}</LinkBtn>
        )}
        {onClearAll && !!selectedCount && (
          <LinkBtn onClick={onClearAll}>{t("Clear all")}</LinkBtn>
        )}
        {children}
      </div>
    </div>
  );
}
