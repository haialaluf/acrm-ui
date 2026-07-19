import { useState } from "react";
import { Wrench } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { type TemplateData } from "@/supabase/client";

import PillSearch from "./PillSearch";
import { countVars } from "./types";

/** Step 2 — pick which APPROVED template to send. Selecting a row advances
 *  automatically (handled by the parent). */
export default function TemplateStep({
  templates,
  selectedId,
  onPick,
  onManage,
}: {
  templates: TemplateData[];
  selectedId?: string;
  onPick: (tpl: TemplateData) => void;
  /** Jump to the templates management page (create/edit templates). */
  onManage?: () => void;
}) {
  const { translate: t } = useTranslation();
  const [search, setSearch] = useState("");
  const filtered = search
    ? templates.filter((tpl) =>
        tpl.name.toLowerCase().includes(search.toLowerCase()),
      )
    : templates;

  return (
    <>
      <div className="px-[16px] pt-[6px] pb-[8px]">
        <PillSearch
          value={search}
          onChange={setSearch}
          placeholder={t("Buscar plantilla")}
        />
      </div>
      <div className="grow overflow-y-auto px-[12px] pb-[12px]">
        <div className="flex flex-col gap-[6px]">
          {filtered.length === 0 && (
            <div className="py-[40px] text-center text-muted-foreground text-[14px]">
              {t("Solo se muestran plantillas aprobadas")}
            </div>
          )}
          {filtered.map((tpl) => {
            const body =
              tpl.components.find((c) => c.type === "BODY")?.text || "";
            const head =
              tpl.components.find((c) => c.type === "HEADER")?.text || "";
            const totalVars = countVars(head) + countVars(body);
            const selected = tpl.id === selectedId;
            return (
              <button
                key={tpl.id}
                onClick={() => onPick(tpl)}
                className="text-start rounded-[14px] p-[14px] transition-all"
                style={{
                  background: selected
                    ? "oklch(from var(--primary) l c h / 0.06)"
                    : "var(--background)",
                  border: `1px solid ${selected ? "var(--primary)" : "var(--border)"}`,
                }}
              >
                <div className="flex items-center justify-between mb-[6px] gap-[6px]">
                  <div className="text-[14px] font-semibold truncate">
                    {tpl.name}
                  </div>
                  <div className="flex items-center gap-[6px] shrink-0">
                    <span
                      className="text-[10px] px-[6px] py-[1px] rounded-full"
                      style={{
                        background: "oklch(from var(--success) l c h / 0.15)",
                        color: "oklch(from var(--success) calc(l - 0.1) c h)",
                      }}
                    >
                      APPROVED
                    </span>
                    <span
                      className="text-[10px] px-[6px] py-[1px] rounded-full"
                      style={{
                        background: "var(--muted)",
                        color: "var(--muted-foreground)",
                      }}
                    >
                      {tpl.category}
                    </span>
                  </div>
                </div>
                <div
                  className="text-[13px] text-muted-foreground"
                  style={{
                    whiteSpace: "pre-wrap",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {body}
                </div>
                <div className="flex items-center flex-wrap gap-x-[10px] gap-y-[4px] mt-[8px] text-[11px] text-muted-foreground">
                  <span>{tpl.language.toUpperCase()}</span>
                  {totalVars > 0 && (
                    <span>
                      · {totalVars} {t("variables")}
                    </span>
                  )}
                  {head && <span>· {t("Encabezado")}</span>}
                </div>
              </button>
            );
          })}
        </div>
        {onManage && (
          <button
            onClick={onManage}
            className="mt-[8px] w-full flex items-center justify-center gap-[6px] rounded-[14px] py-[12px] text-[13px] font-medium text-muted-foreground border border-dashed border-border hover:bg-accent transition-colors"
          >
            <Wrench className="w-[14px] h-[14px]" />
            {t("Gestionar plantillas")}
          </button>
        )}
      </div>
    </>
  );
}
