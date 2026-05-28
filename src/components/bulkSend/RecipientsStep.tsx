import { useMemo, useState } from "react";
import { ArrowLeft, Tag } from "lucide-react";
import Fuse from "fuse.js";

import Button from "@/components/Button";
import SectionFooter from "@/components/SectionFooter";
import { useTranslation } from "@/hooks/useTranslation";
import { useContacts } from "@/queries/useContacts";
import { useContactTags } from "@/queries/useContactTags";

import ContactRow from "./ContactRow";
import LinkBtn from "./LinkBtn";
import ModeTabs from "./ModeTabs";
import PillSearch from "./PillSearch";
import { type RecipientMode } from "./types";

/** Step 1 — pick recipients by browsing contacts or unioning tags. */
export default function RecipientsStep({
  recipientMode,
  setRecipientMode,
  selectedIds,
  setSelectedIds,
  selectedTags,
  setSelectedTags,
  onNext,
}: {
  recipientMode: RecipientMode;
  setRecipientMode: (m: RecipientMode) => void;
  selectedIds: Set<string>;
  setSelectedIds: (s: Set<string>) => void;
  selectedTags: Set<string>;
  setSelectedTags: (s: Set<string>) => void;
  onNext: () => void;
}) {
  const { translate: t } = useTranslation();
  const { data: contacts } = useContacts();
  const { data: tags } = useContactTags();
  const [search, setSearch] = useState("");

  const withAddress = useMemo(
    () => (contacts ?? []).filter((c) => c.addresses?.[0]?.address),
    [contacts],
  );

  const filtered = useMemo(() => {
    if (!search) return withAddress;
    const fuse = new Fuse(withAddress, {
      threshold: 0.4,
      keys: ["name", "email", "addresses.address"],
    });
    return fuse.search(search).map((r) => r.item);
  }, [search, withAddress]);

  function toggleId(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  }

  function toggleTag(tag: string) {
    const nextTags = new Set(selectedTags);
    const nextIds = new Set(selectedIds);
    if (nextTags.has(tag)) {
      nextTags.delete(tag);
      for (const c of withAddress) {
        const cTags = c.tags ?? [];
        if (cTags.includes(tag) && !cTags.some((tt) => nextTags.has(tt))) {
          nextIds.delete(c.id);
        }
      }
    } else {
      nextTags.add(tag);
      for (const c of withAddress) {
        if ((c.tags ?? []).includes(tag)) nextIds.add(c.id);
      }
    }
    setSelectedIds(nextIds);
    setSelectedTags(nextTags);
  }

  return (
    <>
      <div className="px-[16px] pt-[6px] pb-[8px]">
        <ModeTabs mode={recipientMode} onChange={setRecipientMode} />
      </div>

      <div className="grow overflow-y-auto [scrollbar-gutter:stable]">
        {recipientMode === "people" && (
          <>
            <div className="px-[16px] pb-[8px] sticky top-0 z-10 bg-background">
              <PillSearch value={search} onChange={setSearch} placeholder={t("Buscar contacto")} />
              <div className="flex items-center justify-between mt-[10px] px-[2px] text-[12px] text-muted-foreground">
                <span>
                  {filtered.length} {t("contactos")}
                  {search ? ` · ${t("filtrado")}` : ""}
                </span>
                <div className="flex gap-[12px]">
                  <LinkBtn
                    onClick={() => {
                      const next = new Set(selectedIds);
                      filtered.forEach((c) => next.add(c.id));
                      setSelectedIds(next);
                    }}
                  >
                    {t("Seleccionar todos")}
                  </LinkBtn>
                  {selectedIds.size > 0 && (
                    <LinkBtn
                      onClick={() => {
                        setSelectedIds(new Set());
                        setSelectedTags(new Set());
                      }}
                    >
                      {t("Limpiar")}
                    </LinkBtn>
                  )}
                </div>
              </div>
            </div>
            <div className="px-[8px] pb-[12px] flex flex-col gap-[2px]">
              {filtered.map((c) => (
                <ContactRow
                  key={c.id}
                  contact={c}
                  checked={selectedIds.has(c.id)}
                  onToggle={() => toggleId(c.id)}
                />
              ))}
              {filtered.length === 0 && (
                <div className="py-[40px] text-center text-muted-foreground text-[14px]">
                  {t("Sin resultados")}
                </div>
              )}
            </div>
          </>
        )}

        {recipientMode === "tags" && (
          <div className="px-[16px] pt-[4px] pb-[12px]">
            {tags.length === 0 ? (
              <div className="text-[13px] text-muted-foreground py-[40px] text-center">
                {t("Aún no hay etiquetas")}
              </div>
            ) : (
              <>
                <div className="text-[13px] text-muted-foreground mb-[14px]">
                  {t("Elige una o más etiquetas para incluir a todos los contactos marcados (unión).")}
                </div>
                <div className="flex flex-wrap gap-[8px]">
                  {tags.map((tag) => {
                    const count = withAddress.filter((c) => (c.tags ?? []).includes(tag)).length;
                    const on = selectedTags.has(tag);
                    return (
                      <button
                        key={tag}
                        onClick={() => toggleTag(tag)}
                        className="flex items-center gap-[8px] rounded-full pe-[14px] ps-[10px] py-[8px] text-[14px] transition-all"
                        style={{
                          background: on ? "oklch(from var(--primary) l c h / 0.10)" : "var(--background)",
                          border: `1px solid ${on ? "var(--primary)" : "var(--border)"}`,
                          color: on ? "var(--primary)" : "var(--foreground)",
                        }}
                      >
                        <Tag className="w-[12px] h-[12px]" />
                        <span>{tag}</span>
                        <span className="text-[12px] text-muted-foreground">{count}</span>
                      </button>
                    );
                  })}
                </div>

                {selectedTags.size > 0 && (
                  <div className="mt-[20px]">
                    <div className="text-[12px] text-muted-foreground mb-[8px]">
                      {selectedIds.size} {t("contactos seleccionados por etiqueta")}
                    </div>
                    <div
                      className="rounded-[12px] max-h-[260px] overflow-y-auto p-[4px]"
                      style={{ background: "var(--background)", border: "1px solid var(--border)" }}
                    >
                      {withAddress
                        .filter((c) => (c.tags ?? []).some((tt) => selectedTags.has(tt)))
                        .slice(0, 30)
                        .map((c) => (
                          <ContactRow
                            key={c.id}
                            contact={c}
                            checked={selectedIds.has(c.id)}
                            onToggle={() => toggleId(c.id)}
                            dense
                          />
                        ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <SectionFooter className="gap-[10px]">
        <div className="flex items-center justify-between mb-[2px] text-[13px]">
          <div>
            <span className="font-semibold">{selectedIds.size}</span>{" "}
            <span className="text-muted-foreground">{t("destinatarios seleccionados")}</span>
          </div>
          {selectedIds.size > 0 && (
            <LinkBtn
              onClick={() => {
                setSelectedIds(new Set());
                setSelectedTags(new Set());
              }}
            >
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
