import { useMemo, useState } from "react";
import SectionBody from "@/components/SectionBody";
import SectionHeader from "@/components/SectionHeader";
import { useTranslation } from "@/hooks/useTranslation";
import { useContacts } from "@/queries/useContacts";
import SectionItem from "@/components/SectionItem";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Plus, Upload } from "lucide-react";
import Avatar from "@/components/Avatar";
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
  const [filter, setFilter] = useState<ContactFilterValue>(emptyContactFilter);

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

  return (
    <>
      <SectionHeader title={t("Contactos")} />

      <ContactFilter
        value={filter}
        onChange={setFilter}
        contacts={allContacts}
      />

      <SectionBody>
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
        {hasAnyFilter && filtered.length === 0 && (
          <div className="py-[32px] text-center text-muted-foreground text-[14px]">
            {t("Sin resultados")}
          </div>
        )}
        {filtered.map((contact) => (
          <SectionItem
            key={contact.id}
            title={contact.name || t("Sin nombre")}
            description={contact.addresses?.at(0)?.address ? ltrIsolate(formatPhoneNumber(contact.addresses.at(0)!.address)) : t("Sin dirección")}
            aside={
              <Avatar
                fallback={contact.name?.substring(0, 2).toUpperCase() || "?"}
                size={40}
                className="bg-muted text-muted-foreground"
              />
            }
            onClick={() =>
              navigate({
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
