import { Fragment, useMemo, useState } from "react";
import SectionBody from "@/components/SectionBody";
import SectionHeader from "@/components/SectionHeader";
import { useTranslation } from "@/hooks/useTranslation";
import { useContacts, useDeleteContacts } from "@/queries/useContacts";
import SectionItem from "@/components/SectionItem";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ListChecks, Plus, Trash2, Upload } from "lucide-react";
import Avatar, { avatarHue } from "@/components/Avatar";
import Checkbox from "@/components/bulkSend/Checkbox";
import Button from "@/components/Button";
import {
  contactDisplayAddress,
  contactInstagramPicture,
} from "@/utils/ContactAddressUtils";
import ContactFilter, {
  activeFilterCount,
  applyContactFilter,
  emptyContactFilter,
  type ContactFilterValue,
} from "@/components/ContactFilter";
import { useContactMessageActivity } from "@/queries/useContactMessageActivity";

/**
 * The A-Z index letter a contact files under. Anything that does not start
 * with a letter — unnamed contacts, names starting with a digit or a symbol —
 * collects under "#", which the sort keeps at the end so an unnamed contact
 * never opens the list.
 */
function sectionLetter(name: string | null | undefined): string {
  const first = name?.trim().charAt(0);
  if (!first || !/\p{L}/u.test(first)) return "#";
  return first.toLocaleUpperCase();
}

export const Route = createFileRoute("/_auth/contacts/")({
  component: ListContacts,
});

function ListContacts() {
  const { translate: t } = useTranslation();
  const navigate = useNavigate();
  const { data: contacts } = useContacts();
  const { data: activity } = useContactMessageActivity();
  const deleteContacts = useDeleteContacts();
  const [filter, setFilter] = useState<ContactFilterValue>(emptyContactFilter);

  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);

  const allContacts = useMemo(() => contacts ?? [], [contacts]);
  const filtered = useMemo(
    () => applyContactFilter(allContacts, filter, activity),
    [allContacts, filter, activity],
  );

  /** `filtered` split into A-Z sections. Sorted here rather than relying on the
     query's `order("name")`: the section letters only read correctly if the
     order is monotonic in the same collation we group by. */
  const grouped = useMemo(() => {
    const sorted = [...filtered].sort((a, b) => {
      const aOther = sectionLetter(a.name) === "#";
      const bOther = sectionLetter(b.name) === "#";
      if (aOther !== bOther) return aOther ? 1 : -1;
      return (a.name ?? "").localeCompare(b.name ?? "", undefined, {
        sensitivity: "base",
      });
    });

    const sections: { letter: string; contacts: typeof sorted }[] = [];
    for (const contact of sorted) {
      const letter = sectionLetter(contact.name);
      const last = sections[sections.length - 1];
      if (last?.letter === letter) last.contacts.push(contact);
      else sections.push({ letter, contacts: [contact] });
    }
    return sections;
  }, [filtered]);

  const hasAnyFilter =
    filter.search.length > 0 || activeFilterCount(filter) > 0;

  const allSelected =
    filtered.length > 0 && filtered.every((c) => selected.has(c.id));

  function exitSelection() {
    setSelectionMode(false);
    setSelected(new Set());
    setConfirming(false);
  }

  function toggleContact(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((c) => c.id)));
    }
  }

  function handleDelete() {
    deleteContacts.mutate(Array.from(selected), {
      onSuccess: exitSelection,
    });
  }

  return (
    <>
      <SectionHeader
        title={t("Contacts")}
        action={
          allContacts.length > 0 && !selectionMode ? (
            <button
              className="tonal h-[30px] ps-[10px] pe-[12px] rounded-full flex items-center gap-[6px] text-[13.5px] font-semibold"
              onClick={() => setSelectionMode(true)}
            >
              <ListChecks className="w-[15px] h-[15px]" />
              {t("Select")}
            </button>
          ) : undefined
        }
      />

      <ContactFilter
        value={filter}
        onChange={setFilter}
        contacts={allContacts}
      />

      {selectionMode && (
        /* Same box as the action row below — 12px gap, then a 44px row — so
           entering selection mode swaps the controls without moving the list. */
        <div className="px-[20px] pt-[12px]">
          <div className="flex items-center justify-between h-[44px]">
            {/* Select-all + count */}
            <label className="flex items-center gap-[10px] cursor-pointer">
              <Checkbox checked={allSelected} onChange={toggleSelectAll} />
              <span className="text-[14px]">
                {selected.size > 0
                  ? `${selected.size} ${t("selected")}`
                  : t("Select all")}
              </span>
            </label>

            {/* Actions */}
            <div className="flex items-center gap-[14px]">
              <button
                className="flex items-center gap-[6px] text-[14px] text-destructive disabled:text-muted-foreground disabled:opacity-50"
                disabled={selected.size === 0 || deleteContacts.isPending}
                onClick={() => setConfirming(true)}
              >
                <Trash2 className="w-4 h-4" />
                {t("Delete")}
              </button>
              <button
                className="text-[14px] text-muted-foreground"
                onClick={exitSelection}
              >
                {t("Cancel")}
              </button>
            </div>
          </div>

          {confirming && (
            <div
              className="mt-[10px] mb-[12px] rounded-[14px] p-[14px] border"
              style={{
                background: "oklch(from var(--destructive) l c h / 0.06)",
                borderColor: "oklch(from var(--destructive) l c h / 0.25)",
              }}
            >
              <div className="text-[14px] leading-[1.5]">
                {t("Delete the selected contacts?")} ({selected.size}){" "}
                {t("This action cannot be undone.")}
              </div>
              <div className="flex items-center gap-[10px] mt-[12px]">
                <Button
                  className="bg-destructive text-white hover:bg-destructive/90 rounded-full font-semibold text-[14px] px-[22px] py-[9px]"
                  loading={deleteContacts.isPending}
                  onClick={handleDelete}
                >
                  {t("Delete")}
                </Button>
                <button
                  className="text-[14px] text-muted-foreground px-[6px] py-[9px]"
                  onClick={() => setConfirming(false)}
                >
                  {t("Cancel")}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add and Import are actions, not contacts: as 72px list rows they read
          as data and pushed the first real contact 144px down the screen. Same
          two destinations, one 44px row, labels intact.

          Split 62/38 rather than evenly: both stay findable, but the everyday
          action gets the width, and the asymmetry is what lets the longest
          locale ("Ajouter un contact") stay on one line. The leading icon tiles
          are what keep these reading as two distinct objects at only 44px —
          drop below that height and they stop working. */}
      {!selectionMode && (
        <div className="px-[20px] pt-[12px] flex items-stretch gap-[10px] shrink-0">
          <button
            className="btn-gradient flex-[62] min-w-0 h-[44px] rounded-[12px] flex items-center gap-[9px] px-[10px]"
            onClick={() =>
              navigate({
                to: "/contacts/new",
                hash: (prevHash: string | undefined) => prevHash!,
              })
            }
          >
            <span className="tile w-[26px] h-[26px] rounded-[8px] flex items-center justify-center shrink-0">
              <Plus className="w-[16px] h-[16px]" />
            </span>
            <span className="text-[14.5px] font-semibold truncate">
              {t("Add contact")}
            </span>
          </button>
          <button
            className="flex-[38] min-w-0 h-[44px] rounded-[12px] border-[1.5px] border-input bg-popover hover:bg-accent flex items-center gap-[8px] px-[9px]"
            onClick={() =>
              navigate({
                to: "/contacts/import",
                hash: (prevHash: string | undefined) => prevHash!,
              })
            }
          >
            <span className="tonal w-[26px] h-[26px] rounded-[8px] flex items-center justify-center shrink-0">
              <Upload className="w-[16px] h-[16px]" />
            </span>
            <span className="text-[14.5px] font-semibold truncate">
              {t("Import")}
            </span>
          </button>
        </div>
      )}

      <SectionBody>
        {hasAnyFilter && filtered.length === 0 && (
          <div className="py-[32px] text-center text-muted-foreground text-[14px]">
            {t("No results")}
          </div>
        )}
        {grouped.map((section) => (
          <Fragment key={section.letter}>
            {/* Aligned with the avatars: SectionBody's px-[10px] plus the
                row's own pl-[10px]. */}
            <div className="h-[28px] shrink-0 flex items-center px-[10px] text-[12px] font-semibold tracking-[0.08em] text-muted-foreground">
              {section.letter}
            </div>
            {section.contacts.map((contact) => (
              <SectionItem
                key={contact.id}
                selected={selectionMode && selected.has(contact.id)}
                title={contact.name || t("No name")}
                description={
                  contactDisplayAddress(contact) ?? t("No address")
                }
                aside={
                  selectionMode ? (
                    // Holds the avatar's 40px footprint, left-aligned: the
                    // checkbox lands exactly where it would anyway, and the
                    // name and address stay put instead of sliding 20px left.
                    <div className="w-[40px] flex items-center">
                      <Checkbox
                        checked={selected.has(contact.id)}
                        onChange={() => toggleContact(contact.id)}
                      />
                    </div>
                  ) : (
                    <Avatar
                      src={contactInstagramPicture(contact)}
                      fallback={
                        contact.name?.substring(0, 2).toUpperCase() || "?"
                      }
                      size={40}
                      // Unnamed contacts keep the flat grey: there is no name
                      // to colour-code, and grey is itself the signal.
                      hue={contact.name ? avatarHue(contact.id) : null}
                      className="bg-muted text-muted-foreground"
                    />
                  )
                }
                onClick={() =>
                  selectionMode
                    ? toggleContact(contact.id)
                    : navigate({
                        to: `/contacts/${contact.id}`,
                        hash: (prevHash: string | undefined) => prevHash!,
                      })
                }
              />
            ))}
          </Fragment>
        ))}
      </SectionBody>
    </>
  );
}
