import { useMemo, useState } from "react";
import SectionBody from "@/components/SectionBody";
import SectionHeader from "@/components/SectionHeader";
import { useTranslation } from "@/hooks/useTranslation";
import { useContacts, useDeleteContacts } from "@/queries/useContacts";
import SectionItem from "@/components/SectionItem";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Plus, Trash2, Upload } from "lucide-react";
import Avatar from "@/components/Avatar";
import Checkbox from "@/components/bulkSend/Checkbox";
import Button from "@/components/Button";
import { formatPhoneNumber, ltrIsolate } from "@/utils/FormatUtils";
import ContactFilter, {
  activeFilterCount,
  applyContactFilter,
  emptyContactFilter,
  type ContactFilterValue,
} from "@/components/ContactFilter";
import { useContactMessageActivity } from "@/queries/useContactMessageActivity";

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
        title={t("Contactos")}
        action={
          allContacts.length > 0 && !selectionMode ? (
            <button
              className="text-[14px] text-primary"
              onClick={() => setSelectionMode(true)}
            >
              {t("Seleccionar")}
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
        <div className="px-[20px] pb-[12px]">
          <div className="flex items-center justify-between min-h-[36px]">
            {/* Select-all + count */}
            <label className="flex items-center gap-[10px] cursor-pointer">
              <Checkbox checked={allSelected} onChange={toggleSelectAll} />
              <span className="text-[14px]">
                {selected.size > 0
                  ? `${selected.size} ${t("seleccionados")}`
                  : t("Seleccionar todos")}
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
                {t("Eliminar")}
              </button>
              <button
                className="text-[14px] text-muted-foreground"
                onClick={exitSelection}
              >
                {t("Cancelar")}
              </button>
            </div>
          </div>

          {confirming && (
            <div
              className="mt-[10px] rounded-[14px] p-[14px] border"
              style={{
                background: "oklch(from var(--destructive) l c h / 0.06)",
                borderColor: "oklch(from var(--destructive) l c h / 0.25)",
              }}
            >
              <div className="text-[14px] leading-[1.5]">
                {t("¿Eliminar los contactos seleccionados?")} ({selected.size}){" "}
                {t("Esta acción no se puede deshacer.")}
              </div>
              <div className="flex items-center gap-[10px] mt-[12px]">
                <Button
                  className="bg-destructive text-white hover:bg-destructive/90 rounded-full font-semibold text-[14px] px-[22px] py-[9px]"
                  loading={deleteContacts.isPending}
                  onClick={handleDelete}
                >
                  {t("Eliminar")}
                </Button>
                <button
                  className="text-[14px] text-muted-foreground px-[6px] py-[9px]"
                  onClick={() => setConfirming(false)}
                >
                  {t("Cancelar")}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <SectionBody>
        {!selectionMode && (
          <>
            <SectionItem
              title={t("Agregar contacto")}
              aside={
                <div className="p-[8px] bg-primary/10 rounded-full">
                  <Plus className="w-[24px] h-[24px] text-primary" />
                </div>
              }
              onClick={() =>
                navigate({
                  to: "/contacts/new",
                  hash: (prevHash: string | undefined) => prevHash!,
                })
              }
            />
            <SectionItem
              title={t("Importar contactos")}
              description={t("Desde un archivo CSV o Excel")}
              aside={
                <div className="p-[8px] bg-primary/10 rounded-full">
                  <Upload className="w-[24px] h-[24px] text-primary" />
                </div>
              }
              onClick={() =>
                navigate({
                  to: "/contacts/import",
                  hash: (prevHash: string | undefined) => prevHash!,
                })
              }
            />
          </>
        )}
        {hasAnyFilter && filtered.length === 0 && (
          <div className="py-[32px] text-center text-muted-foreground text-[14px]">
            {t("Sin resultados")}
          </div>
        )}
        {filtered.map((contact) => (
          <SectionItem
            key={contact.id}
            selected={selectionMode && selected.has(contact.id)}
            title={contact.name || t("Sin nombre")}
            description={
              contact.addresses?.at(0)?.address
                ? ltrIsolate(
                    formatPhoneNumber(contact.addresses.at(0)!.address),
                  )
                : t("Sin dirección")
            }
            aside={
              selectionMode ? (
                <Checkbox
                  checked={selected.has(contact.id)}
                  onChange={() => toggleContact(contact.id)}
                />
              ) : (
                <Avatar
                  fallback={contact.name?.substring(0, 2).toUpperCase() || "?"}
                  size={40}
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
      </SectionBody>
    </>
  );
}
