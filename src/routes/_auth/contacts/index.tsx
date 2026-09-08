import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ListChecks, Plus, Trash2, Upload } from "lucide-react";

import SectionHeader from "@/components/SectionHeader";
import Button from "@/components/Button";
import ContactList, {
  type ContactListRow,
} from "@/components/contacts/ContactList";
import ContactListToolbar from "@/components/contacts/ContactListToolbar";
import ContactFilter, {
  activeFilterCount,
  applyContactFilter,
  emptyContactFilter,
  type ContactFilterValue,
} from "@/components/ContactFilter";
import { useTranslation } from "@/hooks/useTranslation";
import { useContacts, useDeleteContacts } from "@/queries/useContacts";
import { useContactActivityMatch } from "@/queries/useContactActivity";
import { contactDisplayAddress } from "@/utils/ContactAddressUtils";

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
  const deleteContacts = useDeleteContacts();
  const [filter, setFilter] = useState<ContactFilterValue>(emptyContactFilter);
  const { match: activityMatch } = useContactActivityMatch(filter);

  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);

  const allContacts = useMemo(() => contacts ?? [], [contacts]);
  const filtered = useMemo(
    () => applyContactFilter(allContacts, filter, activityMatch),
    [allContacts, filter, activityMatch],
  );

  /** `filtered` flattened into A-Z letter headers followed by their contacts.
     Sorted here rather than relying on the query's `order("name")`: the
     section letters only read correctly if the order is monotonic in the same
     collation we group by. */
  const rows = useMemo<ContactListRow[]>(() => {
    const sorted = [...filtered].sort((a, b) => {
      const aOther = sectionLetter(a.name) === "#";
      const bOther = sectionLetter(b.name) === "#";
      if (aOther !== bOther) return aOther ? 1 : -1;
      return (a.name ?? "").localeCompare(b.name ?? "", undefined, {
        sensitivity: "base",
      });
    });

    const out: ContactListRow[] = [];
    let letter = "";
    for (const contact of sorted) {
      const next = sectionLetter(contact.name);
      if (next !== letter) {
        letter = next;
        out.push({ kind: "letter", key: `letter:${letter}`, letter });
      }
      out.push({
        kind: "contact",
        key: contact.id,
        contact,
        subtitle: contactDisplayAddress(contact) ?? t("No address"),
      });
    }
    return out;
  }, [filtered, t]);

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

  return (
    <>
      <SectionHeader
        title={t("Contacts")}
        action={
          !selectionMode ? (
            <div className="flex items-center gap-[8px]">
              {allContacts.length > 0 && (
                <button
                  className="w-[36px] h-[36px] rounded-[10px] flex items-center justify-center border border-border text-tonal-foreground hover:bg-accent"
                  title={t("Select")}
                  onClick={() => setSelectionMode(true)}
                >
                  <ListChecks className="w-[17px] h-[17px]" />
                </button>
              )}
              <button
                className="w-[36px] h-[36px] rounded-[10px] flex items-center justify-center border border-border text-tonal-foreground hover:bg-accent"
                title={t("Import contacts")}
                onClick={() =>
                  navigate({
                    to: "/contacts/import",
                    hash: (prevHash: string | undefined) => prevHash!,
                  })
                }
              >
                <Upload className="w-[17px] h-[17px]" />
              </button>
              <button
                className="btn-gradient h-[36px] ps-[12px] pe-[15px] rounded-full flex items-center gap-[7px] text-[14px] font-semibold"
                title={t("Add contact")}
                onClick={() =>
                  navigate({
                    to: "/contacts/new",
                    hash: (prevHash: string | undefined) => prevHash!,
                  })
                }
              >
                <Plus className="w-[17px] h-[17px]" />
                {t("Add")}
              </button>
            </div>
          ) : undefined
        }
      />

      <ContactFilter
        value={filter}
        onChange={setFilter}
        contacts={allContacts}
      />

      <ContactListToolbar
        count={filtered.length}
        label={t("contacts")}
        selectedCount={selectionMode ? selected.size : undefined}
        onSelectAll={
          selectionMode && !allSelected
            ? () => setSelected(new Set(filtered.map((c) => c.id)))
            : undefined
        }
        onClearAll={selectionMode ? () => setSelected(new Set()) : undefined}
      >
        {selectionMode && (
          <>
            <button
              className="flex items-center gap-[6px] text-[13px] text-destructive disabled:text-muted-foreground disabled:opacity-50"
              disabled={selected.size === 0 || deleteContacts.isPending}
              onClick={() => setConfirming(true)}
            >
              <Trash2 className="w-[14px] h-[14px]" />
              {t("Delete")}
            </button>
            <button className="text-[13px]" onClick={exitSelection}>
              {t("Cancel")}
            </button>
          </>
        )}
      </ContactListToolbar>

      {confirming && (
        <div
          className="mx-[20px] mb-[12px] rounded-[14px] p-[14px] border"
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
              onClick={() =>
                deleteContacts.mutate(Array.from(selected), {
                  onSuccess: exitSelection,
                })
              }
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

      <ContactList
        rows={rows}
        scrollResetKey={filter}
        selectedKeys={selectionMode ? selected : undefined}
        onToggle={toggleContact}
        onOpen={(id) =>
          navigate({
            to: `/contacts/${id}`,
            hash: (prevHash: string | undefined) => prevHash!,
          })
        }
        empty={
          hasAnyFilter ? (
            <div className="py-[32px] text-center text-muted-foreground text-[14px]">
              {t("No results")}
            </div>
          ) : null
        }
      />
    </>
  );
}
