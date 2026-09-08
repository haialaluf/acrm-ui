import Avatar, { avatarHue } from "@/components/Avatar";
import Checkbox from "@/components/Checkbox";
import { useTranslation } from "@/hooks/useTranslation";
import type { ContactWithAddressesRow } from "@/supabase/client";
import { contactInstagramPicture } from "@/utils/ContactAddressUtils";

export default function ContactListItem({
  contact,
  subtitle,
  dense,
  selected,
  onToggle,
  onOpen,
  disabledReason,
}: {
  contact: ContactWithAddressesRow;
  /** The one address this row stands for, already formatted for display. */
  subtitle: string;
  dense?: boolean;
  selected?: boolean;
  /** Present in selection mode: draws the checkbox and owns the row click. */
  onToggle?: () => void;
  onOpen?: () => void;
  disabledReason?: string;
}) {
  const { translate: t } = useTranslation();
  const disabled = !!disabledReason;
  const activate = onToggle ?? onOpen;
  const interactive = !disabled && !!activate;

  return (
    <div
      title={disabledReason ?? contact.name ?? undefined}
      aria-disabled={disabled || undefined}
      onClick={interactive ? activate : undefined}
      className={
        `flex items-center h-full rounded-xl px-[10px] ${dense ? "gap-[10px]" : "gap-[15px]"} ` +
        (disabled
          ? "cursor-not-allowed opacity-50 "
          : interactive
            ? "cursor-pointer "
            : "") +
        (selected ? "bg-primary/8 " : interactive ? "hover:bg-accent " : "")
      }
    >
      {onToggle && (
        <Checkbox
          checked={!!selected}
          onChange={disabled ? () => {} : onToggle}
        />
      )}
      <Avatar
        src={contactInstagramPicture(contact)}
        fallback={contact.name?.substring(0, 2).toUpperCase() || "?"}
        size={dense ? 34 : 40}
        // Unnamed contacts keep the flat grey: there is no name to
        // colour-code, and grey is itself the signal.
        hue={contact.name ? avatarHue(contact.id) : null}
        className="bg-muted text-muted-foreground"
      />
      <div className="flex flex-col justify-center grow min-w-0">
        <div
          className={`truncate text-foreground ${dense ? "text-[14px]" : "text-[16px]"}`}
        >
          {contact.name || t("No name")}
        </div>
        <div
          className={`mt-[2px] truncate text-muted-foreground ${dense ? "text-[12px]" : "text-[14px]"}`}
        >
          {subtitle}
        </div>
      </div>
    </div>
  );
}
