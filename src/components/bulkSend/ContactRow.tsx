import Avatar from "@/components/Avatar";
import { type ContactWithAddressesRow } from "@/supabase/client";
import Checkbox from "./Checkbox";
import { recipientAddressLabel, type Channel } from "./types";

/** A single selectable recipient row: the contact's name over the ONE address
 *  this copy would go to, so a contact with two numbers reads as two rows
 *  rather than one ambiguous entry. `dense` shrinks the avatar so the
 *  tags-mode preview can fit more rows. */
export default function ContactRow({
  contact,
  address,
  channel,
  checked,
  onToggle,
  dense,
  disabled,
  disabledReason,
}: {
  contact: ContactWithAddressesRow;
  /** The address this row stands for — a phone number on WhatsApp, a mailbox
   *  on email. Shown as-is under the name; it is what the send goes to. */
  address: string;
  channel: Channel;
  checked: boolean;
  onToggle: () => void;
  dense?: boolean;
  disabled?: boolean;
  disabledReason?: string;
}) {
  return (
    <label
      className={
        "flex items-center gap-[10px] rounded-[10px] transition-colors " +
        (disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer")
      }
      style={{
        padding: dense ? "6px 10px" : "8px 10px",
        background: checked
          ? "oklch(from var(--primary) l c h / 0.06)"
          : "transparent",
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
        <div
          className="text-[12px] text-muted-foreground truncate"
          style={{ direction: "ltr", textAlign: "start" }}
        >
          {recipientAddressLabel(address, channel)}
        </div>
      </div>
    </label>
  );
}
