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
import { BOOKING_DURATIONS } from "@/queries/useBookingLinks";
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
  headerMediaName,
  headerMediaSize,
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
  booking,
}: {
  template: TemplateData;
  vars: Record<string, VarValue>;
  headerMedia: string;
  headerMediaName: string;
  headerMediaSize?: number;
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
  /** Set only when this template carries a booking-link button. Every recipient
   *  gets their own token, minted against one calendar for one duration — both
   *  are properties of the link, so they are asked for here rather than baked
   *  into the template. */
  booking?: {
    calendars: { id: string; name: string }[];
    calendarsLoading: boolean;
    calendarId: string;
    setCalendarId: (id: string) => void;
    duration: number;
    setDuration: (minutes: number) => void;
  };
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
      butt?.buttons?.map((b) => buttonDefToPreview(b, t("Copy code"))) ?? [];

    const hasMedia = mediaFmt != null && isValidMediaUrl(headerMedia);
    return {
      headerType: mediaFmt ?? (headerText ? "TEXT" : "NONE"),
      headerText,
      headerVars: [],
      mediaUrl: hasMedia ? headerMedia.trim() : "",
      mediaName:
        mediaFmt === "DOCUMENT"
          ? // The picked file's real name. Falling back to the URL's last path
            // segment would show the storage object's random UUID, not the
            // document the user chose. Kept only as a last resort for a URL
            // with no known name.
            (headerMediaName ||
              headerMedia.trim().split("/").pop()?.split("?")[0] ||
              "")
          : "",
      mediaSize: mediaFmt === "DOCUMENT" ? headerMediaSize : undefined,
      body: bodyText,
      bodyVars: [],
      footer,
      buttons,
      rtl:
        detectRtl(bodyText, headerText, footer) ||
        isRtl(template.language as Language),
    };
  }, [template, vars, current, headerMedia, headerMediaName, headerMediaSize, t]);

  const canSend =
    recipients.length > 0 &&
    (effective !== "later" || !!scheduledAt) &&
    // A booking template with no calendar chosen would send everyone the
    // template's example link instead of their own.
    (!booking || !!booking.calendarId);

  return (
    <>
      <div className="grow overflow-y-auto">
        <div className="px-[16px] pt-[14px]">
          <div className="flex items-center justify-between mb-[10px]">
            <div className="text-[12px] text-muted-foreground">
              {t("Preview for")}
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
            {recipients.length} {t("recipients")}
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
                  title={t("Remove")}
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
                {t("You selected more than the daily limit — how to send")}
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
                      {t("Split into")} {batches.length} {t("days")}
                      <span
                        className="text-[10px] rounded-full px-[6px] py-[1px]"
                        style={{
                          background: "oklch(from var(--primary) l c h / 0.12)",
                          color: "var(--primary)",
                        }}
                      >
                        {t("Recommended")}
                      </span>
                    </div>
                    <div className="text-[12px] text-muted-foreground">
                      {t("To")} {dailyLimit} {t("per day")} —{" "}
                      {batches[0]?.list.length ?? 0} {t("today")},{" "}
                      {t("the rest on the following days")}
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
                    <div className="text-[14px]">{t("Send all now")}</div>
                    <div
                      className="text-[12px]"
                      style={{
                        color: "oklch(from var(--warning) calc(l - 0.15) c h)",
                      }}
                    >
                      {t("Exceeds the limit — messages above")} {dailyLimit}{" "}
                      {t("could be blocked")}
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
                {t("When to send")}
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
                    <div className="text-[14px]">{t("Send now")}</div>
                    <div className="text-[12px] text-muted-foreground">
                      {t("Will be sent in a single batch")}
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
                    <div className="text-[14px]">{t("Schedule for later")}</div>
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
                            placeholder={t("Choose date and time")}
                            allowClear
                          />
                        </ConfigProvider>
                      </div>
                    ) : (
                      <div className="text-[12px] text-muted-foreground">
                        {t("Choose date and time")}
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

      {booking && (
        <div className="px-[16px] pb-[12px]">
          <div className="flex items-center gap-[6px] text-[12px] text-muted-foreground mb-[6px]">
            <CalendarClock className="w-[14px] h-[14px]" />
            {t("Booking link")}
          </div>
          {booking.calendars.length === 0 && !booking.calendarsLoading ? (
            <div className="text-[12px] text-destructive">
              {t(
                "This template sends a booking link, but you have no calendar yet. Create one to send it.",
              )}
            </div>
          ) : (
            <>
              <div className="flex gap-[8px]">
                <select
                  className="grow min-w-0 h-[38px] px-[10px] rounded-[8px] border border-input bg-card text-[14px]"
                  value={booking.calendarId}
                  onChange={(e) => booking.setCalendarId(e.target.value)}
                  aria-label={t("Calendar for the booking link")}
                >
                  <option value="">{t("Choose a calendar")}</option>
                  {booking.calendars.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <select
                  className="w-[130px] shrink-0 h-[38px] px-[10px] rounded-[8px] border border-input bg-card text-[14px]"
                  value={booking.duration}
                  onChange={(e) => booking.setDuration(Number(e.target.value))}
                  aria-label={t("Appointment duration")}
                >
                  {BOOKING_DURATIONS.map((m) => (
                    <option key={m} value={m}>
                      {t("{{1}} minutes").replace("{{1}}", String(m))}
                    </option>
                  ))}
                </select>
              </div>
              <div className="text-[11px] text-muted-foreground mt-[6px]">
                {t("Each recipient gets their own link to this calendar.")}
              </div>
            </>
          )}
        </div>
      )}

      <SectionFooter className="gap-[8px]">
        {effective === "split" && (
          <div className="flex items-center justify-between mb-[2px] text-[12px]">
            <span className="text-muted-foreground">{t("Split")}</span>
            <span>
              <b>{todayCount}</b> {t("today")} · {remaining} {t("scheduled")}
            </span>
          </div>
        )}
        <Button className="primary" onClick={onSend} invalid={!canSend}>
          <span className="inline-flex items-center justify-center gap-[8px]">
            <Send className="w-[16px] h-[16px]" />
            {effective === "split"
              ? `${t("Send")} ${todayCount} ${t("today and schedule the rest")}`
              : effective === "now"
                ? `${t("Send to")} ${recipients.length} ${t("recipients")}`
                : t("Schedule send")}
          </span>
        </Button>
      </SectionFooter>
    </>
  );
}
