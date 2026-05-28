import Avatar from "@/components/Avatar";
import { type ContactWithAddressesRow } from "@/supabase/client";
import { formatPhoneNumber, ltrIsolate } from "@/utils/FormatUtils";
import Checkbox from "./Checkbox";

/** A single selectable contact row in the recipients list. `dense` shrinks the
 *  avatar so the tags-mode preview can fit more rows. */
export default function ContactRow({
  contact,
  checked,
  onToggle,
  dense,
  disabled,
  disabledReason,
}: {
  contact: ContactWithAddressesRow;
  checked: boolean;
  onToggle: () => void;
  dense?: boolean;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const phone = contact.addresses?.[0]?.address;
  return (
    <label
      className={
        "flex items-center gap-[10px] rounded-[10px] transition-colors " +
        (disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer")
      }
      style={{
        padding: dense ? "6px 10px" : "8px 10px",
        background: checked ? "oklch(from var(--primary) l c h / 0.06)" : "transparent",
      }}
      title={disabled ? disabledReason : undefined}
      aria-disabled={disabled || undefined}
    >
      <Checkbox checked={checked} onChange={disabled ? () => {} : onToggle} />
      <Avatar
        fallback={contact.name?.substring(0, 2).toUpperCase() || "?"}
        size={dense ? 32 : 38}
        className="bg-muted text-muted-foreground"
      />
      <div className="flex-1 min-w-0">
        <div className="text-[14px] truncate">{contact.name || "—"}</div>
        {phone && (
          <div
            className="text-[12px] text-muted-foreground truncate"
            style={{ direction: "ltr", textAlign: "start" }}
          >
            {ltrIsolate(formatPhoneNumber(phone))}
          </div>
        )}
      </div>
    </label>
  );
}
