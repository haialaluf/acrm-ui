import { useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";

import Button from "@/components/Button";
import SectionFooter from "@/components/SectionFooter";
import { useTranslation } from "@/hooks/useTranslation";
import { useContacts } from "@/queries/useContacts";
import ContactFilter, {
  applyContactFilter,
  emptyContactFilter,
  type ContactFilterValue,
} from "@/components/ContactFilter";

import ContactRow from "./ContactRow";
import LinkBtn from "./LinkBtn";

/** Step 1 — pick recipients with the unified filter (search + tags + source + date). */
export default function RecipientsStep({
  selectedIds,
  setSelectedIds,
  onNext,
}: {
  selectedIds: Set<string>;
  setSelectedIds: (s: Set<string>) => void;
  onNext: () => void;
}) {
  const { translate: t } = useTranslation();
  const { data: contacts } = useContacts();
  const [filter, setFilter] = useState<ContactFilterValue>(emptyContactFilter);

  const withAddress = useMemo(
    () => (contacts ?? []).filter((c) => c.addresses?.[0]?.address),
    [contacts],
  );

  const filtered = useMemo(
    () => applyContactFilter(withAddress, filter),
    [withAddress, filter],
  );

  function toggleId(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  }

  const removedReason = t("Este contacto solicitó ser eliminado");

  return (
    <>
      <div className="grow overflow-y-auto [scrollbar-gutter:stable]">
        <div className="sticky top-0 z-10 bg-background pt-[6px]">
          <ContactFilter
            value={filter}
            onChange={setFilter}
            contacts={withAddress}
            className="px-[16px] pb-[8px]"
          />
          <div className="px-[18px] pb-[8px] flex items-center justify-between text-[12px] text-muted-foreground">
            <span>
              {filtered.length} {t("contactos")}
            </span>
            <div className="flex gap-[12px]">
              <LinkBtn
                onClick={() => {
                  const next = new Set(selectedIds);
                  setSelectedIds(next);
                }}
              >
                {t("Seleccionar todos")}
              </LinkBtn>
              {selectedIds.size > 0 && (
                <LinkBtn onClick={() => setSelectedIds(new Set())}>
                  {t("Limpiar")}
                </LinkBtn>
              )}
            </div>
          </div>
        </div>

        <div className="px-[8px] pb-[12px] flex flex-col gap-[2px]">
          {filtered.map((c) => {
            const isRemoved =
              c.status === "removed" ||
              c.addresses?.[0]?.status === "removed";
            return (
              <ContactRow
                key={c.id}
                contact={c}
                checked={selectedIds.has(c.id)}
                onToggle={() => toggleId(c.id)}
                disabled={isRemoved}
                disabledReason={isRemoved ? removedReason : undefined}
              />
            );
          })}
          {filtered.length === 0 && (
            <div className="py-[40px] text-center text-muted-foreground text-[14px]">
              {t("Sin resultados")}
            </div>
          )}
        </div>
      </div>

      <SectionFooter className="gap-[10px]">
        <div className="flex items-center justify-between mb-[2px] text-[13px]">
          <div>
            <span className="font-semibold">{selectedIds.size}</span>{" "}
            <span className="text-muted-foreground">{t("destinatarios seleccionados")}</span>
          </div>
          {selectedIds.size > 0 && (
            <LinkBtn onClick={() => setSelectedIds(new Set())}>
              {t("Limpiar todo")}
            </LinkBtn>
          )}
        </div>
        <Button className="primary" onClick={onNext} invalid={selectedIds.size === 0}>
          <span className="inline-flex items-center justify-center gap-[8px]">
            {t("Elegir plantilla")}
            <ArrowLeft className="w-[16px] h-[16px] rotate-180" />
          </span>
        </Button>
      </SectionFooter>
    </>
  );
}
