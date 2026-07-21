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
  applyContactFilter,
  emptyContactFilter,
  type ContactFilterValue,
} from "@/components/ContactFilter";

export const Route = createFileRoute("/_auth/contacts/")({
  component: ListContacts,
});

function ListContacts() {
  const { translate: t } = useTranslation();
  const navigate = useNavigate();
  const { data: contacts } = useContacts();
  const deleteContacts = useDeleteContacts();
  const [filter, setFilter] = useState<ContactFilterValue>(emptyContactFilter);

  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);

  const allContacts = useMemo(() => contacts ?? [], [contacts]);
  const filtered = useMemo(
    () => applyContactFilter(allContacts, filter),
    [allContacts, filter],
  );

  const hasAnyFilter =
    filter.search.length > 0 ||
    filter.tags.length > 0 ||
    filter.sources.length > 0 ||
    filter.dateFrom != null ||
    filter.dateTo != null;

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
      <SectionHeader title={t("Contactos")} />

      <ContactFilter
        value={filter}
        onChange={setFilter}
        contacts={allContacts}
      />

      {allContacts.length > 0 && (
        <div className="px-[20px] pb-[12px] flex items-center gap-[8px] min-h-[40px]">
          {!selectionMode ? (
            <button
              className="ml-auto text-[14px] text-primary font-medium hover:underline"
              onClick={() => setSelectionMode(true)}
            >
              {t("Seleccionar")}
            </button>
          ) : (
            <>
              <label className="flex items-center gap-[8px] cursor-pointer text-[14px]">
                <Checkbox checked={allSelected} onChange={toggleSelectAll} />
                <span>
                  {selected.size > 0
                    ? `${selected.size} ${t("seleccionados")}`
                    : t("Seleccionar todos")}
                </span>
              </label>

              <div className="ml-auto flex items-center gap-[8px]">
                <button
                  className="text-[14px] text-muted-foreground hover:underline"
                  onClick={exitSelection}
                >
                  {t("Cancelar")}
                </button>
                <Button
                  className="text-destructive hover:text-destructive/90 px-4 py-2 rounded-full font-medium text-[14px]"
                  invalid={selected.size === 0}
                  loading={deleteContacts.isPending}
                  onClick={() => setConfirming(true)}
                >
                  <Trash2 className="w-4 h-4" />
                  {t("Eliminar")}
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {confirming && (
        <div className="px-[20px] pb-[12px]">
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-[16px] flex flex-col gap-[12px]">
            <div className="text-[14px]">
              {t("¿Eliminar los contactos seleccionados?")} ({selected.size})
            </div>
            <div className="flex items-center gap-[8px]">
              <Button
                className="bg-destructive text-white hover:bg-destructive/90 px-4 py-2 rounded-full font-medium text-[14px]"
                loading={deleteContacts.isPending}
                onClick={handleDelete}
              >
                {t("Eliminar")}
              </Button>
              <button
                className="text-[14px] text-muted-foreground hover:underline px-4 py-2"
                onClick={() => setConfirming(false)}
              >
                {t("Cancelar")}
              </button>
            </div>
          </div>
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
