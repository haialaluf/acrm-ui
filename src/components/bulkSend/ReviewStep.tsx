import { useMemo, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight, Clock, Send, X } from "lucide-react";

import Avatar from "@/components/Avatar";
import Button from "@/components/Button";
import SectionFooter from "@/components/SectionFooter";
import TemplatePreviewBubble from "@/components/TemplatePreviewBubble";
import { useTranslation } from "@/hooks/useTranslation";
import {
  type ContactWithAddressesRow,
  type TemplateData,
} from "@/supabase/client";
import { formatPhoneNumber, ltrIsolate } from "@/utils/FormatUtils";

import NavBtn from "./NavBtn";
import Radio from "./Radio";
import { fillTemplate, type Scheduling, type VarValue } from "./types";

/** Step 4 — per-contact preview using the real `<TemplatePreviewBubble>`,
 *  recipient chips with remove, and schedule (now / later) selector. */
export default function ReviewStep({
  template,
  vars,
  recipients,
  onRemove,
  scheduling,
  setScheduling,
  scheduledAt,
  setScheduledAt,
  onSend,
}: {
  template: TemplateData;
  vars: Record<string, VarValue>;
  recipients: ContactWithAddressesRow[];
  onRemove: (id: string) => void;
  scheduling: Scheduling;
  setScheduling: (s: Scheduling) => void;
  scheduledAt: string;
  setScheduledAt: (s: string) => void;
  onSend: () => void;
}) {
  const { translate: t } = useTranslation();
  const [idx, setIdx] = useState(0);
  const safeIdx = Math.min(idx, Math.max(0, recipients.length - 1));
  const current = recipients[safeIdx];

  // Build a transient TemplateData with header/body text already substituted
  // for the currently-previewed contact so the bubble renders verbatim.
  const previewTemplate = useMemo<TemplateData | null>(() => {
    if (!current) return null;
    return {
      ...template,
      components: template.components.map((c) => {
        if (c.type === "HEADER") {
          return { ...c, text: fillTemplate(c.text, "head", vars, current) };
        }
        if (c.type === "BODY") {
          return { ...c, text: fillTemplate(c.text, "body", vars, current) };
        }
        return c;
      }),
    };
  }, [template, vars, current]);

  const canSend = recipients.length > 0 && (scheduling === "now" || !!scheduledAt);

  return (
    <>
      <div className="grow overflow-y-auto">
        <div className="px-[16px] pt-[14px]">
          <div className="flex items-center justify-between mb-[10px]">
            <div className="text-[12px] text-muted-foreground">
              {t("Vista previa para")}
            </div>
            <div className="flex items-center gap-[8px]">
              <NavBtn onClick={() => setIdx(Math.max(0, safeIdx - 1))}>
                <ChevronRight className="w-[14px] h-[14px]" />
              </NavBtn>
              <div className="text-[12px] text-muted-foreground">
                {recipients.length ? safeIdx + 1 : 0}/{recipients.length}
              </div>
              <NavBtn onClick={() => setIdx(Math.min(recipients.length - 1, safeIdx + 1))}>
                <ChevronLeft className="w-[14px] h-[14px]" />
              </NavBtn>
            </div>
          </div>

          <div
            className="rounded-[14px] overflow-hidden"
            style={{ background: "var(--background)", border: "1px solid var(--border)" }}
          >
            <div
              className="flex items-center gap-[10px] px-[12px] py-[10px]"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <Avatar
                fallback={current?.name?.substring(0, 2).toUpperCase() || "?"}
                size={32}
                className="bg-muted text-muted-foreground"
              />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] truncate">{current?.name || "—"}</div>
                {current?.addresses?.[0]?.address && (
                  <div
                    className="text-[11px] truncate text-muted-foreground"
                    style={{ direction: "ltr", textAlign: "start" }}
                  >
                    {ltrIsolate(formatPhoneNumber(current.addresses[0].address))}
                  </div>
                )}
              </div>
            </div>
            {previewTemplate && <TemplatePreviewBubble template={previewTemplate} />}
          </div>
        </div>

        <div className="px-[16px] mt-[16px]">
          <div className="text-[12px] text-muted-foreground mb-[8px]">
            {recipients.length} {t("destinatarios")}
          </div>
          <div
            className="flex flex-wrap gap-[5px] max-h-[110px] overflow-y-auto rounded-[12px] p-[8px]"
            style={{ background: "var(--background)", border: "1px solid var(--border)" }}
          >
            {recipients.slice(0, 60).map((c) => (
              <span
                key={c.id}
                className="inline-flex items-center gap-[5px] rounded-full px-[8px] py-[3px] text-[12px]"
                style={{ background: "var(--muted)" }}
              >
                {c.name || c.addresses?.[0]?.address}
                <button
                  type="button"
                  onClick={() => onRemove(c.id)}
                  className="text-muted-foreground hover:text-foreground bg-transparent border-none p-0 inline-flex"
                  title={t("Quitar")}
                >
                  <X className="w-[11px] h-[11px]" />
                </button>
              </span>
            ))}
            {recipients.length > 60 && (
              <span
                className="inline-flex items-center rounded-full px-[8px] py-[3px] text-[12px] text-muted-foreground"
                style={{ background: "var(--muted)" }}
              >
                +{recipients.length - 60}
              </span>
            )}
          </div>
        </div>

        <div className="px-[16px] mt-[16px] pb-[16px]">
          <div className="text-[12px] text-muted-foreground mb-[8px]">
            {t("Cuándo enviar")}
          </div>
          <div
            className="rounded-[12px] overflow-hidden"
            style={{ background: "var(--background)", border: "1px solid var(--border)" }}
          >
            <button
              type="button"
              onClick={() => setScheduling("now")}
              className="w-full flex items-center gap-[10px] p-[12px] text-start border-none cursor-pointer"
              style={{
                background:
                  scheduling === "now" ? "oklch(from var(--primary) l c h / 0.04)" : "transparent",
              }}
            >
              <Radio checked={scheduling === "now"} />
              <div className="flex-1">
                <div className="text-[14px]">{t("Enviar ahora")}</div>
                <div className="text-[12px] text-muted-foreground">
                  {t("Se enviará en un único lote")}
                </div>
              </div>
              <Clock className="w-[16px] h-[16px] text-muted-foreground" />
            </button>
            <div style={{ height: 1, background: "var(--border)" }} />
            <button
              type="button"
              onClick={() => setScheduling("later")}
              className="w-full flex items-start gap-[10px] p-[12px] text-start border-none cursor-pointer"
              style={{
                background:
                  scheduling === "later" ? "oklch(from var(--primary) l c h / 0.04)" : "transparent",
              }}
            >
              <div className="mt-[2px]">
                <Radio checked={scheduling === "later"} />
              </div>
              <div className="flex-1">
                <div className="text-[14px]">{t("Programar para más tarde")}</div>
                {scheduling === "later" ? (
                  <input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-[6px] text-[13px] rounded-[8px] p-[6px] outline-none"
                    dir="ltr"
                    style={{
                      background: "var(--background)",
                      border: "1px solid var(--border)",
                    }}
                  />
                ) : (
                  <div className="text-[12px] text-muted-foreground">
                    {t("Elige fecha y hora")}
                  </div>
                )}
              </div>
              <Calendar className="w-[16px] h-[16px] text-muted-foreground" />
            </button>
          </div>
        </div>
      </div>

      <SectionFooter className="gap-[8px]">
        <Button className="primary" onClick={onSend} invalid={!canSend}>
          <span className="inline-flex items-center justify-center gap-[8px]">
            <Send className="w-[16px] h-[16px]" />
            {scheduling === "now"
              ? `${t("Enviar a")} ${recipients.length} ${t("destinatarios")}`
              : t("Programar envío")}
          </span>
        </Button>
      </SectionFooter>
    </>
  );
}
