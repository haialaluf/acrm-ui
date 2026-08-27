import { useEffect, useMemo, useRef, useState } from "react";
import { UserPlus, X } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import Avatar from "@/components/Avatar";
import SearchBar from "@/components/SearchBar";
import Spinner from "@/components/Spinner";
import { useContacts, useLinkAddressToContact } from "@/queries/useContacts";
import { useTranslation } from "@/hooks/useTranslation";
import {
  formatPhoneNumber,
  ltrIsolate,
  nameInitials,
} from "@/utils/FormatUtils";
import { contactEmail, contactPhone } from "@/utils/ContactAddressUtils";

/**
 * Attach a conversation's address to a contact — the fix for a thread that
 * shows a bare number or an @handle because nobody ever linked it.
 *
 * Two ways out: pick an existing contact (the address joins them, merging the
 * two records if it turns out to belong to someone else already), or create a
 * new contact carrying the address, which is the contact form with the address
 * handed over in the URL.
 */
export default function LinkAddressToContactModal({
  open,
  address,
  service,
  /** Name to seed a new contact with — an Instagram profile name, a push name. */
  suggestedName,
  /** Instagram @username, shown instead of the igsid wherever the address is. */
  username,
  onClose,
}: {
  open: boolean;
  address: string;
  service: string;
  suggestedName?: string;
  username?: string;
  onClose: () => void;
}) {
  const { translate: t } = useTranslation();
  const navigate = useNavigate();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [search, setSearch] = useState("");

  const { data: contacts, isPending } = useContacts();
  const linkAddress = useLinkAddressToContact();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    if (open) setSearch("");
  }, [open]);

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();

    return (contacts ?? [])
      .map((contact) => ({
        contact,
        name: [contact.name, contact.surname].filter(Boolean).join(" "),
        phone: contactPhone(contact),
        email: contactEmail(contact),
      }))
      .filter(
        (row) =>
          !query ||
          row.name.toLowerCase().includes(query) ||
          row.phone?.includes(query) ||
          row.email?.toLowerCase().includes(query),
      )
      .slice(0, 50);
  }, [contacts, search]);

  /** What the user sees this thread called — never a raw igsid if avoidable. */
  const addressLabel = username
    ? `@${username}`
    : service === "whatsapp"
      ? ltrIsolate(formatPhoneNumber(address))
      : address;

  return (
    <dialog
      ref={dialogRef}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
      className={
        "m-auto max-h-[calc(100vh-32px)] w-[calc(100vw-32px)] max-w-[380px] " +
        "overflow-y-auto rounded-2xl border-0 bg-popover p-0 text-foreground shadow-xl " +
        "backdrop:bg-black/50 " +
        "open:opacity-100 open:scale-100 opacity-0 scale-95 " +
        "starting:open:opacity-0 starting:open:scale-95 " +
        "transition-[opacity,transform] duration-150 ease-out"
      }
    >
      <div className="flex items-start justify-between gap-3 px-5 pt-5">
        <h2 className="m-0 text-[16px] font-semibold text-foreground">
          {t("Link to contact")}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("Close")}
          className="-m-1 shrink-0 rounded-full p-1 text-muted-foreground hover:text-foreground"
        >
          <X className="h-[18px] w-[18px]" />
        </button>
      </div>

      <div className="px-5 pt-1 text-[13px] text-muted-foreground">
        <span dir="ltr">{addressLabel}</span>
      </div>

      <div className="px-5 pt-3">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder={t("Search name or number")}
          className="flex"
        />
      </div>

      <div className="flex max-h-[300px] flex-col gap-[2px] overflow-y-auto px-[10px] pt-[10px]">
        {isPending && (
          <div className="flex justify-center py-[24px] text-muted-foreground">
            <Spinner />
          </div>
        )}

        {!isPending && rows.length === 0 && (
          <div className="py-[24px] text-center text-[14px] text-muted-foreground">
            {t("No results")}
          </div>
        )}

        {rows.map(({ contact, name, phone, email }) => (
          <button
            key={contact.id}
            type="button"
            disabled={linkAddress.isPending}
            onClick={() =>
              linkAddress.mutate(
                { contactId: contact.id, service, address },
                { onSuccess: onClose },
              )
            }
            className="flex items-center gap-[12px] rounded-xl p-[8px] text-start hover:bg-accent disabled:opacity-50"
          >
            <Avatar
              fallback={nameInitials(name || "?")}
              size={40}
              className="bg-accent text-accent-foreground border border-border text-[15px] shrink-0"
            />
            <div className="min-w-0 grow">
              <div className="truncate text-[15px] text-foreground">
                {name || t("No name")}
              </div>
              <div className="mt-[2px] truncate text-[13px] text-muted-foreground">
                {phone
                  ? ltrIsolate(formatPhoneNumber(phone))
                  : (email ?? t("No address"))}
              </div>
            </div>
          </button>
        ))}
      </div>

      {linkAddress.error && (
        <p className="px-5 pt-3 text-[13px] text-destructive">
          {t("Could not link the address. Please try again.")}
        </p>
      )}

      <div className="flex items-center justify-between gap-3 px-5 pb-5 pt-[14px]">
        <button
          type="button"
          className="bg-secondary text-secondary-foreground hover:bg-secondary/80 px-4 py-2 rounded-full font-medium transition-colors text-[14px] flex items-center gap-2"
          onClick={() => {
            onClose();
            void navigate({
              to: "/contacts/new",
              search: {
                address,
                service,
                name: suggestedName,
                username,
              },
              hash: (prevHash: string | undefined) => prevHash!,
            });
          }}
        >
          <UserPlus className="w-4 h-4" />
          {t("Create a new contact")}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full px-[10px] py-[8px] text-[15px] text-muted-foreground hover:text-foreground"
        >
          {t("Cancel")}
        </button>
      </div>
    </dialog>
  );
}
