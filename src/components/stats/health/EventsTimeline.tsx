import { useState } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import type { LogRow } from "@/queries/useWhatsAppHealth";
import { Card, CardHead, FilterPill, TONE, type Tone } from "./primitives";

const LEVEL_TONE: Record<string, Tone> = {
  error: "destructive",
  warning: "warning",
  info: "primary",
};

/**
 * `logs.category` is the raw producer name. Grouped into the handful of things
 * an operator actually distinguishes between.
 */
const CATEGORY_LABEL: Record<string, string> = {
  account_update: "Account",
  phone_number_quality_update: "Quality",
  message_template_status_update: "Template",
  message_template_quality_update: "Template",
  health_poll: "Health check",
};

/** Whether Meta pushed this to us, or we found it on a scheduled check. */
const isScheduled = (category: string) => category === "health_poll";

/**
 * What Meta has told us about this number, newest first.
 *
 * Only real `logs` rows — this is a record of events that happened, not a
 * re-derivation of the charts above.
 */
export default function EventsTimeline({ events }: { events: LogRow[] }) {
  const { translate: t } = useTranslation();
  const [level, setLevel] = useState<"all" | "error" | "warning" | "info">(
    "all",
  );

  const filters: { key: typeof level; label: string }[] = [
    { key: "all", label: t("All") },
    { key: "error", label: t("Error") },
    { key: "warning", label: t("Warning") },
    { key: "info", label: t("Info") },
  ];

  const rows = events.filter((e) => level === "all" || e.level === level);

  return (
    <Card>
      <CardHead
        title={t("Timeline")}
        right={
          <div className="flex gap-[5px] flex-wrap">
            {filters.map((f) => (
              <FilterPill
                key={f.key}
                label={f.label}
                active={level === f.key}
                onClick={() => setLevel(f.key)}
              />
            ))}
          </div>
        }
      />
      {!rows.length ? (
        <div className="text-[13px] text-muted-foreground py-[8px]">
          {level === "all"
            ? t("No events reported for this number yet.")
            : t("No events at this level.")}
        </div>
      ) : (
        <div className="flex flex-col">
          {rows.map((event, i) => (
            <div key={event.id} className="flex gap-[12px] pb-[14px]">
              <div className="flex flex-col items-center shrink-0 w-[10px]">
                <span
                  className={`rounded-full w-[8px] h-[8px] mt-[5px] ${TONE[LEVEL_TONE[event.level] ?? "neutral"].dot}`}
                />
                {i < rows.length - 1 && (
                  <span className="grow w-px bg-border mt-[4px]" />
                )}
              </div>
              <div className="min-w-0 grow">
                <div className="flex items-baseline justify-between gap-[8px]">
                  <span className="text-[11px] text-muted-foreground">
                    {t(CATEGORY_LABEL[event.category] ?? event.category)}
                    {isScheduled(event.category)
                      ? ` · ${t("Scheduled check")}`
                      : ` · ${t("Live event")}`}
                  </span>
                  <span className="text-[11px] shrink-0 whitespace-nowrap text-muted-foreground tabular-nums">
                    {new Date(event.created_at).toLocaleString(undefined, {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <div className="text-[12.5px] mt-[2px] leading-relaxed">
                  {event.message}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
