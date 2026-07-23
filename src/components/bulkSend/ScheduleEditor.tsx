import { AlertTriangle, CalendarClock, Check, Info } from "lucide-react";
import { ConfigProvider, DatePicker } from "antd";
import dayjs, { type Dayjs } from "dayjs";

import { useTranslation } from "@/hooks/useTranslation";
import { datePickerTokens } from "@/components/antdTokens";
import {
  type Batch,
  type BatchSchedule,
  batchesInsideWindow,
  DEFAULT_SEND_TIME,
  resolveBatchSchedule,
  type ScheduleMode,
} from "./types";

const datePickerTheme = { components: { DatePicker: datePickerTokens } };

/**
 * Editable schedule for a split broadcast. Defaults to a read-only timeline
 * (batch 0 now, the rest on consecutive days). Toggling "custom" reveals a
 * date + time picker per batch so the user can pick exactly when each later
 * batch goes out. Overrides live in `schedule`, keyed by absolute batch index.
 */
export default function ScheduleEditor({
  batches,
  schedule,
  setSchedule,
  mode,
  setMode,
}: {
  batches: Batch<unknown>[];
  schedule: BatchSchedule;
  setSchedule: (s: BatchSchedule) => void;
  mode: ScheduleMode;
  setMode: (m: ScheduleMode) => void;
}) {
  const { translate: t, currentLanguage } = useTranslation();
  const custom = mode === "custom";
  // Batches a user override has pushed inside WhatsApp's rolling 24h window.
  // The defaults never land here; only hand-picked dates can.
  const tooSoon = batchesInsideWindow(batches, schedule);

  /** Human label ("Hoy" / "Mañana" / weekday) + short date for an ISO date. */
  function dayLabel(isoDate: string) {
    const d = new Date(`${isoDate}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
    const date = `${d.getDate()}.${d.getMonth() + 1}`;
    if (diff <= 0) return { label: t("Hoy"), date };
    if (diff === 1) return { label: t("Mañana"), date };
    const weekday = new Intl.DateTimeFormat(currentLanguage, {
      weekday: "long",
    }).format(d);
    return { label: weekday, date };
  }

  function setRow(index: number, patch: { date?: string; time?: string }) {
    setSchedule({ ...schedule, [index]: { ...schedule[index], ...patch } });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-[8px]">
        <div className="text-[12px] text-muted-foreground">
          {t("Calendario de envío")}
        </div>
        <button
          type="button"
          onClick={() => setMode(custom ? "auto" : "custom")}
          className="flex items-center gap-[5px] text-[12px] rounded-full ps-[9px] pe-[11px] py-[4px] cursor-pointer"
          style={{
            background: custom
              ? "oklch(from var(--primary) l c h / 0.10)"
              : "var(--background)",
            border: `1px solid ${custom ? "var(--primary)" : "var(--border)"}`,
            color: custom ? "var(--primary)" : "var(--muted-foreground)",
          }}
        >
          {custom ? (
            <Check className="w-[13px] h-[13px]" />
          ) : (
            <CalendarClock className="w-[13px] h-[13px]" />
          )}
          {custom ? t("Terminar edición") : t("Elegir fechas y horas")}
        </button>
      </div>

      <div className="flex flex-col">
        {batches.map((b, i) => {
          const { isoDate, time } = resolveBatchSchedule(schedule, i);
          const isToday = i === 0;
          const flagged = tooSoon.has(i);
          const { label, date } = dayLabel(isoDate);
          const value = dayjs(`${isoDate}T${time || DEFAULT_SEND_TIME}`);
          return (
            <div
              key={i}
              className="flex items-center gap-[10px]"
              style={{
                padding: custom ? "8px 0" : "7px 0",
                borderTop: i ? "1px solid var(--border)" : "none",
              }}
            >
              <div
                className="rounded-full flex items-center justify-center shrink-0"
                style={{
                  width: 24,
                  height: 24,
                  background: flagged
                    ? "var(--destructive)"
                    : isToday
                      ? "var(--primary)"
                      : "oklch(from var(--primary) l c h / 0.10)",
                  color:
                    flagged || isToday
                      ? "var(--primary-foreground)"
                      : "var(--primary)",
                  fontSize: 11,
                  fontWeight: 700,
                }}
                title={
                  flagged
                    ? t("Menos de 24 h desde el lote anterior")
                    : undefined
                }
              >
                {i + 1}
              </div>

              {custom ? (
                <div className="flex-1 min-w-0" dir="ltr">
                  <ConfigProvider theme={datePickerTheme}>
                    <DatePicker
                      size="small"
                      showTime={{ format: "HH:mm" }}
                      format="YYYY-MM-DD HH:mm"
                      minuteStep={5}
                      value={value}
                      onChange={(d: Dayjs | null) => {
                        if (!d) return;
                        setRow(i, {
                          date: d.format("YYYY-MM-DD"),
                          time: d.format("HH:mm"),
                        });
                      }}
                      disabledDate={(d) =>
                        !!d && d.isBefore(dayjs().startOf("day"))
                      }
                      allowClear={false}
                      className="w-full"
                    />
                  </ConfigProvider>
                </div>
              ) : (
                <div className="flex-1 min-w-0 text-[13px]">
                  {label}{" "}
                  <span className="text-[11px] text-muted-foreground">
                    {date} · {isToday && !time ? t("ahora") : time}
                  </span>
                </div>
              )}

              <div className="text-[13px] font-semibold">{b.list.length}</div>
              <div className="text-[11px] text-muted-foreground">
                {t("mensajes")}
              </div>
            </div>
          );
        })}
      </div>

      {tooSoon.size > 0 && (
        <div
          className="text-[11px] mt-[10px] flex items-start gap-[6px] rounded-[10px] p-[10px]"
          style={{
            color: "var(--destructive)",
            background: "oklch(from var(--destructive) l c h / 0.08)",
            border: "1px solid oklch(from var(--destructive) l c h / 0.25)",
          }}
        >
          <AlertTriangle className="w-[13px] h-[13px] mt-[1px] shrink-0" />
          <span>
            {t(
              "Hay lotes programados a menos de 24 h del anterior. WhatsApp cuenta los destinatarios en una ventana móvil de 24 h, así que esos mensajes serán rechazados. Separa cada lote al menos 24 h.",
            )}
          </span>
        </div>
      )}

      {custom && (
        <div className="text-[11px] mt-[10px] flex items-start gap-[6px] text-muted-foreground">
          <Info className="w-[13px] h-[13px] mt-[1px] shrink-0" />
          {t(
            "Cada lote se enviará en la fecha y hora elegidas. Puedes cambiarlo hasta el momento del envío.",
          )}
        </div>
      )}
    </div>
  );
}
