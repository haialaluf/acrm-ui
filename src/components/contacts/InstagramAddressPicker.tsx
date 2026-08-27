import { useEffect, useMemo, useRef, useState } from "react";
import { Instagram, X } from "lucide-react";
import Avatar from "@/components/Avatar";
import SearchBar from "@/components/SearchBar";
import Spinner from "@/components/Spinner";
import { useInstagramAddresses } from "@/queries/useContactsAddresses";
import type {
  ContactAddressRow,
  InstagramContactAddressExtra,
} from "@/supabase/client";
import { useTranslation } from "@/hooks/useTranslation";
import { nameInitials } from "@/utils/FormatUtils";
import { fill } from "@/utils/fill";

/** A `contacts_addresses` row with the contact that owns it today, if any. */
export type InstagramAddressRow = ContactAddressRow & {
  contact: { id: string; name: string | null; surname: string | null } | null;
};

/**
 * Pick an Instagram account to attach to a contact.
 *
 * Deliberately a picker and not a text field: an Instagram address is an
 * igsid, an id scoped to our own IG account that Meta only ever hands us on an
 * inbound event (`instagram-webhook`), and the send path uses it verbatim as
 * `recipient.id`. A typed @username resolves to nothing we could message, so
 * the only honest input is "one of the people who have written to us" — the
 * footnote says so rather than leaving the user hunting for the missing field.
 *
 * Built on the native <dialog> for the same reason ConfirmModal is (see its
 * comment): it renders in the browser's top layer instead of racing antd's
 * portal timing on mobile.
 */
export default function InstagramAddressPicker({
  open,
  excluded,
  onPick,
  onCancel,
}: {
  open: boolean;
  /** Addresses already on the form — shown as picked, not selectable again. */
  excluded: Set<string>;
  onPick: (row: InstagramAddressRow) => void;
  onCancel: () => void;
}) {
  const { translate: t } = useTranslation();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [search, setSearch] = useState("");

  // Only fetch once the picker is actually opened: every contact page would
  // otherwise pull the org's whole Instagram address book on mount.
  const { data: addresses, isPending } = useInstagramAddresses(open);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  // Reopening should not inherit the previous search.
  useEffect(() => {
    if (open) setSearch("");
  }, [open]);

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase().replace(/^@/, "");

    return ((addresses ?? []) as InstagramAddressRow[])
      .map((row) => {
        const extra = (row.extra ?? {}) as InstagramContactAddressExtra;
        const owner = row.contact
          ? [row.contact.name, row.contact.surname].filter(Boolean).join(" ")
          : "";

        return {
          row,
          username: extra.username,
          name: extra.name,
          picture: extra.profile_picture_url,
          owner: owner || undefined,
        };
      })
      .filter(
        (item) =>
          !query ||
          item.username?.toLowerCase().includes(query) ||
          item.name?.toLowerCase().includes(query) ||
          item.owner?.toLowerCase().includes(query) ||
          item.row.address.includes(query),
      )
      .sort((a, b) => (a.username ?? "").localeCompare(b.username ?? ""));
  }, [addresses, search]);

  return (
    <dialog
      ref={dialogRef}
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      onClick={(e) => {
        if (e.target === dialogRef.current) onCancel();
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
          {t("Add Instagram")}
        </h2>
        <button
          type="button"
          onClick={onCancel}
          aria-label={t("Close")}
          className="-m-1 shrink-0 rounded-full p-1 text-muted-foreground hover:text-foreground"
        >
          <X className="h-[18px] w-[18px]" />
        </button>
      </div>

      <div className="px-5 pt-3">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder={t("Search by username")}
          className="flex"
        />
      </div>

      <div className="flex max-h-[320px] flex-col gap-[2px] overflow-y-auto px-[10px] pt-[10px]">
        {isPending && (
          <div className="flex justify-center py-[24px] text-muted-foreground">
            <Spinner />
          </div>
        )}

        {!isPending && rows.length === 0 && (
          <div className="py-[24px] text-center text-[14px] text-muted-foreground">
            {search
              ? t("No results")
              : t("Nobody has messaged your Instagram account yet")}
          </div>
        )}

        {rows.map(({ row, username, name, picture, owner }) => {
          const alreadyOnForm = excluded.has(row.address);

          return (
            <button
              key={row.address}
              type="button"
              disabled={alreadyOnForm}
              onClick={() => onPick(row)}
              className={
                "flex items-center gap-[12px] rounded-xl p-[8px] text-start " +
                (alreadyOnForm ? "opacity-50" : "hover:bg-accent")
              }
            >
              <Avatar
                src={picture}
                fallback={nameInitials(name || username || "?")}
                size={40}
                className="bg-accent text-accent-foreground border border-border text-[15px] shrink-0"
              />
              <div className="min-w-0 grow">
                <div className="truncate text-[15px] text-foreground" dir="ltr">
                  {username ? `@${username}` : row.address}
                </div>
                <div className="mt-[2px] truncate text-[13px] text-muted-foreground">
                  {alreadyOnForm
                    ? t("Already added")
                    : owner
                      ? fill(t, "Linked to {name}", { name: owner })
                      : t("Not linked to a contact")}
                </div>
              </div>
              <Instagram className="h-[16px] w-[16px] shrink-0 text-muted-foreground" />
            </button>
          );
        })}
      </div>

      <div className="px-5 pb-5 pt-[14px] text-[12px] leading-[1.5] text-muted-foreground">
        {t(
          "Only people who have messaged your Instagram account appear here — Instagram gives no way to reach someone by username alone.",
        )}
      </div>
    </dialog>
  );
}
