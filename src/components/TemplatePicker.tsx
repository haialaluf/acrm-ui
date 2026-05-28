import { useState, useRef, useEffect } from "react";
import { Plus } from "lucide-react";
import useBoundStore from "@/stores/useBoundStore";
import SearchBar from "@/components/SearchBar";
import { useTemplates } from "@/queries/useTemplates";
import { useContactByAddress } from "@/queries/useContacts";
import { useTranslation } from "@/hooks/useTranslation";
import type { TemplateData } from "@/supabase/client";
import { useNavigate } from "@tanstack/react-router";

export default function TemplatePicker() {
  const activeConvId = useBoundStore((store) => store.ui.activeConvId);
  const conv = useBoundStore((store) =>
    store.chat.conversations.get(store.ui.activeConvId || ""),
  );
  const toggle = useBoundStore((store) => store.ui.toggle);

  const orgAddress = conv?.organization_address;
  const { data: templates, isLoading } = useTemplates(orgAddress);
  const { data: contact } = useContactByAddress(conv?.contact_address);
  const approved = templates?.filter((t) => t.status === "APPROVED");

  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const { translate: t } = useTranslation();
  const navigate = useNavigate();

  const filtered = search
    ? approved?.filter((tpl) =>
        tpl.name.toLowerCase().includes(search.toLowerCase()),
      )
    : approved;

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") toggle("templatePicker", false);
    }
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        toggle("templatePicker", false);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onClick);
    };
  }, [toggle]);

  function select(template: TemplateData) {
    if (!activeConvId || !contact?.id) return;

    // Hand off to the bulk-send wizard, pre-filled with this contact +
    // template, jumping straight to the Variables step. Keeps the wizard as
    // the single surface for filling/sending templates (kept here in the
    // same left panel, so the drawer placement does not change).
    toggle("templatePicker", false);
    navigate({
      to: "/conversations/bulk-send",
      search: { contactId: contact.id, templateId: template.id },
      hash: (h) => h!,
    });
  }

  return (
    <div
      ref={ref}
      className="absolute bottom-0 w-full max-h-[320px] overflow-hidden flex flex-col z-20 bg-background rounded-[24px] shadow-lg"
    >
      {/* Search */}
      <SearchBar
        value={search}
        onChange={setSearch}
        placeholder={t("Buscar plantilla...")}
        autoFocus
        size="small"
        className="px-[40px] pt-[12px] pb-[8px] flex"
      />

      {/* List — ChatList style */}
      <div className="overflow-y-auto px-[40px] pb-[8px] mb-[16px]">
        <div className="flex flex-col gap-[4px]">
          {isLoading ? (
            <div className="px-[10px] py-[8px] text-muted-foreground text-[13px]">
              {t("Cargando...")}
            </div>
          ) : !filtered?.length ? (
            <div className="px-[10px] py-[8px] text-muted-foreground text-[13px]">
              {t("Solo se muestran plantillas aprobadas")}
            </div>
          ) : (
            filtered.map((tpl) => {
              const body = tpl.components.find((c) => c.type === "BODY")?.text || "";
              return (
                <button
                  key={tpl.id}
                  className="w-full text-left px-[10px] py-[8px] rounded-xl hover:bg-accent cursor-pointer"
                  onClick={() => select(tpl)}
                >
                  <div className="font-medium text-[14px] truncate">{tpl.name}</div>
                  <div className="text-[13px] text-muted-foreground truncate">
                    {body}
                  </div>
                </button>
              );
            })
          )}
          {orgAddress && (
            <div
              className="w-full text-left px-[10px] py-[8px] rounded-xl hover:bg-accent cursor-pointer"
              onClick={() => {
                toggle("templatePicker", false);
                navigate({
                  to: "/integrations/whatsapp/$orgAddressId/templates/new",
                  params: { orgAddressId: orgAddress },
                  hash: (prevHash) => prevHash!,
                });
              }}
            >
              <div className="font-medium text-[14px] flex items-center gap-[4px]">
                <Plus className="w-[14px] h-[14px]" />
                {t("Crear plantilla")}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
