import { useTranslation } from "@/hooks/useTranslation";
import { type Batch } from "./types";

/** Day-by-day breakdown of a broadcast split across the daily messaging limit.
 *  Batch 0 goes out today; each subsequent batch on a following day. */
export default function BatchTimeline<T>({ batches }: { batches: Batch<T>[] }) {
  const { translate: t, currentLanguage } = useTranslation();

  function dayLabel(offset: number) {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    const date = `${d.getDate()}.${d.getMonth() + 1}`;
    if (offset === 0) return { label: t("Hoy"), date };
    if (offset === 1) return { label: t("Mañana"), date };
    const weekday = new Intl.DateTimeFormat(currentLanguage, {
      weekday: "long",
    }).format(d);
    return { label: weekday, date };
  }

  return (
    <div className="flex flex-col">
      {batches.map((b, i) => {
        const { label, date } = dayLabel(b.dayOffset);
        const isToday = b.dayOffset === 0;
        return (
          <div
            key={i}
            className="flex items-center gap-[10px] py-[6px]"
            style={{ borderTop: i ? "1px solid var(--border)" : "none" }}
          >
            <div
              className="rounded-full flex items-center justify-center shrink-0"
              style={{
                width: 24,
                height: 24,
                background: isToday
                  ? "var(--primary)"
                  : "oklch(from var(--primary) l c h / 0.10)",
                color: isToday ? "var(--primary-foreground)" : "var(--primary)",
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              {i + 1}
            </div>
            <div className="flex-1 min-w-0 text-[13px]">
              {label}{" "}
              <span className="text-[11px] text-muted-foreground">{date}</span>
            </div>
            <div className="text-[13px] font-semibold">{b.list.length}</div>
            <div className="text-[11px] text-muted-foreground">
              {t("mensajes")}
            </div>
          </div>
        );
      })}
    </div>
  );
}
