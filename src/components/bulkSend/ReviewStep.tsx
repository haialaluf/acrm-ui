import { useMemo, useState } from "react";
import {
  Calendar,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Clock,
  Send,
  TriangleAlert,
  X,
} from "lucide-react";
import { ConfigProvider, DatePicker } from "antd";
import dayjs, { type Dayjs } from "dayjs";

import Avatar from "@/components/Avatar";
import Button from "@/components/Button";
import SectionFooter from "@/components/SectionFooter";
import WhatsAppPreview from "@/components/messagePreview/WhatsAppPreview";
import { detectRtl } from "@/components/messagePreview/rtl";
import type { MessagePreviewData } from "@/components/messagePreview/types";
import {
  buttonDefToPreview,
  type PreviewButton,
} from "@/components/templateButtons";
import { useTranslation } from "@/hooks/useTranslation";
import { isRtl, type Language } from "@/stores/uiSlice";
import {
  type ContactWithAddressesRow,
  type TemplateData,
} from "@/supabase/client";
import { formatPhoneNumber, ltrIsolate } from "@/utils/FormatUtils";

import NavBtn from "./NavBtn";
import Radio from "./Radio";
import QuotaMeter from "./QuotaMeter";
import ScheduleEditor from "./ScheduleEditor";
import { datePickerTokens } from "@/components/antdTokens";
import {
  type Batch,
  type BatchSchedule,
  effectiveScheduling,
  fillTemplate,
  headerMediaFormat,
  immediateCount,
  isValidMediaUrl,
  type Scheduling,
  type ScheduleMode,
  type VarValue,
} from "./types";

const datePickerTheme = { components: { DatePicker: datePickerTokens } };

/** Step 4 — per-contact preview using the shared `<WhatsAppPreview>`,
 *  recipient chips with remove, and schedule (now / later) selector. */
export default function ReviewStep({
  template,
  vars,
  headerMedia,
  recipients,
  onRemove,
  scheduling,
  setScheduling,
  scheduledAt,
  setScheduledAt,
  onSend,
  dailyLimit,
  tier,
  batches,
  batchSchedule,
  setBatchSchedule,
  scheduleMode,
  setScheduleMode,
  bookingCalendars,
  bookingCalendarId,
  setBookingCalendarId,
}: {
  template: TemplateData;
  vars: Record<string, VarValue>;
  headerMedia: string;
  recipients: ContactWithAddressesRow[];
  onRemove: (id: string) => void;
  scheduling: Scheduling;
  setScheduling: (s: Scheduling) => void;
  scheduledAt: string;
  setScheduledAt: (s: string) => void;
  onSend: () => void;
  dailyLimit: number | null;
  tier?: string | null;
  batches: Batch<ContactWithAddressesRow>[];
  batchSchedule: BatchSchedule;
  setBatchSchedule: (s: BatchSchedule) => void;
  scheduleMode: ScheduleMode;
  setScheduleMode: (m: ScheduleMode) => void;
  /** Set only when this template carries a booking link AND the org has more
   *  than one calendar — with a single calendar there is nothing to ask. */
  bookingCalendars?: { id: string; name: string }[];
  bookingCalendarId: string;
  setBookingCalendarId: (id: string) => void;
}) {
  const { translate: t } = useTranslation();
  const [idx, setIdx] = useState(0);

  const overLimit = dailyLimit != null && recipients.length > dailyLimit;
  const effective = effectiveScheduling(scheduling, overLimit);
  // Recipients going out immediately. In a custom split any batch (including
  // batch 0) may be scheduled for later, so count the ones with no send time.
  const todayCount =
    effective === "split"
      ? immediateCount(batches, batchSchedule)
      : recipients.length;
  const remaining = recipients.length - todayCount;
  const safeIdx = Math.min(idx, Math.max(0, recipients.length - 1));
  const current = recipients[safeIdx];

  // Build the normalized preview payload for the currently-previewed contact,
  // with header/body variables already substituted, so the shared WhatsApp
  // preview renders the exact message this recipient receives.
  const previewData = useMemo<MessagePreviewData | null>(() => {
    if (!current) return null;
    const head = template.components.find((c) => c.type === "HEADER");
    const body = template.components.find((c) => c.type === "BODY");
    const foot = template.components.find((c) => c.type === "FOOTER");
    const butt = template.components.find((c) => c.type === "BUTTONS");

    const mediaFmt = headerMediaFormat(template);
    const headerText =
      head && head.format === "TEXT"
        ? fillTemplate(head.text, "head", vars, current)
        : "";
    const bodyText = fillTemplate(body?.text, "body", vars, current);
    const footer = foot?.text ?? "";
    const buttons: PreviewButton[] =
      butt?.buttons?.map((b) => buttonDefToPreview(b, t("Copiar código"))) ??
      [];

    const hasMedia = mediaFmt != null && isValidMediaUrl(headerMedia);
    return {
      headerType: mediaFmt ?? (headerText ? "TEXT" : "NONE"),
      headerText,
      headerVars: [],
      mediaUrl: hasMedia ? headerMedia.trim() : "",
      mediaName:
        mediaFmt === "DOCUMENT"
          ? (headerMedia.trim().split("/").pop() ?? "")
          : "",
      body: bodyText,
      bodyVars: [],
      footer,
      buttons,
      rtl:
        detectRtl(bodyText, headerText, footer) ||
        isRtl(template.language as Language),
    };
  }, [template, vars, current, headerMedia, t]);

  const canSend =
    recipients.length > 0 &&
    (effective !== "later" || !!scheduledAt) &&
    // A booking template with no calendar chosen would send everyone the
    // template's example link instead of their own.
    (!bookingCalendars?.length || !!bookingCalendarId);

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
                <ChevronLeft className="w-[14px] h-[14px]" />
              </NavBtn>
              <div className="text-[12px] text-muted-foreground">
                {recipients.length ? safeIdx + 1 : 0}/{recipients.length}
              </div>
              <NavBtn
                onClick={() =>
                  setIdx(Math.min(recipients.length - 1, safeIdx + 1))
                }
              >
                <ChevronRight className="w-[14px] h-[14px]" />
              </NavBtn>
            </div>
          </div>

          <div
            className="rounded-[14px] overflow-hidden"
            style={{
              background: "var(--background)",
              border: "1px solid var(--border)",
            }}
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
                <div className="text-[13px] truncate">
                  {current?.name || "—"}
                </div>
                {current?.addresses?.[0]?.address && (
                  <div
                    className="text-[11px] truncate text-muted-foreground"
                    style={{ direction: "ltr", textAlign: "start" }}
                  >
                    {ltrIsolate(
                      formatPhoneNumber(current.addresses[0].address),
                    )}
                  </div>
                )}
              </div>
            </div>
            {previewData && (
              <WhatsAppPreview data={previewData} variant="bubble" />
            )}
          </div>
        </div>

        <div className="px-[16px] mt-[16px]">
          <div className="text-[12px] text-muted-foreground mb-[8px]">
            {recipients.length} {t("destinatarios")}
          </div>
          <div
            className="flex flex-wrap gap-[5px] max-h-[110px] overflow-y-auto rounded-[12px] p-[8px]"
            style={{
              background: "var(--background)",
              border: "1px solid var(--border)",
            }}
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
          {dailyLimit != null && (
            <div className="mb-[10px]">
              <QuotaMeter
                selected={recipients.length}
                dailyLimit={dailyLimit}
                tier={tier}
              />
            </div>
          )}

          {overLimit ? (
            <>
              <div className="text-[12px] text-muted-foreground mb-[8px]">
                {t("Seleccionaste más que el límite diario — cómo enviar")}
              </div>
              <div
                className="rounded-[12px] overflow-hidden"
                style={{
                  background: "var(--background)",
                  border: "1px solid var(--border)",
                }}
              >
                <button
                  type="button"
                  onClick={() => setScheduling("split")}
                  className="w-full flex items-start gap-[10px] p-[12px] text-start border-none cursor-pointer"
                  style={{
                    background:
                      effective === "split"
                        ? "oklch(from var(--primary) l c h / 0.05)"
                        : "transparent",
                  }}
                >
                  <div className="mt-[2px]">
                    <Radio checked={effective === "split"} />
                  </div>
                  <div className="flex-1">
                    <div className="text-[14px] flex items-center gap-[6px]">
                      {t("Dividir en")} {batches.length} {t("días")}
                      <span
                        className="text-[10px] rounded-full px-[6px] py-[1px]"
                        style={{
                          background: "oklch(from var(--primary) l c h / 0.12)",
                          color: "var(--primary)",
                        }}
                      >
                        {t("Recomendado")}
                      </span>
                    </div>
                    <div className="text-[12px] text-muted-foreground">
                      {t("Hasta")} {dailyLimit} {t("por día")} —{" "}
                      {batches[0]?.list.length ?? 0} {t("hoy")},{" "}
                      {t("el resto los días siguientes")}
                    </div>
                  </div>
                  <CalendarClock className="w-[18px] h-[18px] text-muted-foreground" />
                </button>
                {effective === "split" && (
                  <div
                    style={{
                      paddingInlineStart: 42,
                      paddingInlineEnd: 12,
                      paddingBottom: 12,
                    }}
                  >
                    <ScheduleEditor
                      batches={batches}
                      schedule={batchSchedule}
                      setSchedule={setBatchSchedule}
                      mode={scheduleMode}
                      setMode={setScheduleMode}
                    />
                  </div>
                )}
                <div style={{ height: 1, background: "var(--border)" }} />
                <button
                  type="button"
                  onClick={() => setScheduling("now")}
                  className="w-full flex items-start gap-[10px] p-[12px] text-start border-none cursor-pointer"
                  style={{
                    background:
                      effective === "now"
                        ? "oklch(from var(--warning) l c h / 0.06)"
                        : "transparent",
                  }}
                >
                  <div className="mt-[2px]">
                    <Radio checked={effective === "now"} />
                  </div>
                  <div className="flex-1">
                    <div className="text-[14px]">{t("Enviar todo ahora")}</div>
                    <div
                      className="text-[12px]"
                      style={{
                        color: "oklch(from var(--warning) calc(l - 0.15) c h)",
                      }}
                    >
                      {t("Excede el límite — los mensajes por encima de")}{" "}
                      {dailyLimit} {t("podrían ser bloqueados")}
                    </div>
                  </div>
                  <TriangleAlert
                    className="w-[18px] h-[18px]"
                    style={{
                      color: "oklch(from var(--warning) calc(l - 0.1) c h)",
                    }}
                  />
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="text-[12px] text-muted-foreground mb-[8px]">
                {t("Cuándo enviar")}
              </div>
              <div
                className="rounded-[12px] overflow-hidden"
                style={{
                  background: "var(--background)",
                  border: "1px solid var(--border)",
                }}
              >
                <button
                  type="button"
                  onClick={() => setScheduling("now")}
                  className="w-full flex items-center gap-[10px] p-[12px] text-start border-none cursor-pointer"
                  style={{
                    background:
                      scheduling === "now"
                        ? "oklch(from var(--primary) l c h / 0.04)"
                        : "transparent",
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
                      scheduling === "later"
                        ? "oklch(from var(--primary) l c h / 0.04)"
                        : "transparent",
                  }}
                >
                  <div className="mt-[2px]">
                    <Radio checked={scheduling === "later"} />
                  </div>
                  <div className="flex-1">
                    <div className="text-[14px]">
                      {t("Programar para más tarde")}
                    </div>
                    {scheduling === "later" ? (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="mt-[6px]"
                        dir="ltr"
                      >
                        <ConfigProvider theme={datePickerTheme}>
                          <DatePicker
                            showTime={{ format: "HH:mm" }}
                            format="YYYY-MM-DD HH:mm"
                            minuteStep={5}
                            value={scheduledAt ? dayjs(scheduledAt) : null}
                            onChange={(d: Dayjs | null) =>
                              setScheduledAt(
                                d ? d.format("YYYY-MM-DDTHH:mm") : "",
                              )
                            }
                            disabledDate={(d) =>
                              d && d.isBefore(dayjs().startOf("day"))
                            }
                            placeholder={t("Elige fecha y hora")}
                            allowClear
                          />
                        </ConfigProvider>
                      </div>
                    ) : (
                      <div className="text-[12px] text-muted-foreground">
                        {t("Elige fecha y hora")}
                      </div>
                    )}
                  </div>
                  <Calendar className="w-[16px] h-[16px] text-muted-foreground" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {!!bookingCalendars?.length && (
        <div className="px-[16px] pb-[12px]">
          <div className="text-[12px] text-muted-foreground mb-[6px]">
            {t("Calendario para el enlace de reserva")}
          </div>
          <select
            className="w-full h-[38px] px-[10px] rounded-[8px] border border-input bg-card text-[14px]"
            value={bookingCalendarId}
            onChange={(e) => setBookingCalendarId(e.target.value)}
          >
            <option value="">{t("Elige un calendario")}</option>
            {bookingCalendars.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <SectionFooter className="gap-[8px]">
        {effective === "split" && (
          <div className="flex items-center justify-between mb-[2px] text-[12px]">
            <span className="text-muted-foreground">{t("Se divide")}</span>
            <span>
              <b>{todayCount}</b> {t("hoy")} · {remaining} {t("programados")}
            </span>
          </div>
        )}
        <Button className="primary" onClick={onSend} invalid={!canSend}>
          <span className="inline-flex items-center justify-center gap-[8px]">
            <Send className="w-[16px] h-[16px]" />
            {effective === "split"
              ? `${t("Enviar")} ${todayCount} ${t("hoy y programar el resto")}`
              : effective === "now"
                ? `${t("Enviar a")} ${recipients.length} ${t("destinatarios")}`
                : t("Programar envío")}
          </span>
        </Button>
      </SectionFooter>
    </>
  );
}
