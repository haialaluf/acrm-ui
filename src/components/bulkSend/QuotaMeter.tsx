import { Clock } from "lucide-react";

import { useTranslation } from "@/hooks/useTranslation";

/** Compact daily-quota meter: how many recipients are selected vs the WhatsApp
 *  daily messaging limit fetched from Meta. Turns to a warning tone when the
 *  selection exceeds the limit. Render only when `dailyLimit != null`. */
export default function QuotaMeter({
  selected,
  dailyLimit,
  tier,
}: {
  selected: number;
  dailyLimit: number;
  tier?: string | null;
}) {
  const { translate: t } = useTranslation();
  const over = selected > dailyLimit;
  const pct = dailyLimit
    ? Math.min(100, (Math.min(selected, dailyLimit) / dailyLimit) * 100)
    : 0;

  return (
    <div
      className="rounded-[10px] px-[12px] py-[9px]"
      style={{
        background: over
          ? "oklch(from var(--warning) l c h / 0.10)"
          : "var(--background)",
        border: `1px solid ${
          over ? "oklch(from var(--warning) l c h / 0.5)" : "var(--border)"
        }`,
      }}
    >
      <div className="flex items-center justify-between text-[12px] mb-[6px]">
        <span className="flex items-center gap-[5px] text-muted-foreground">
          <Clock className="w-[13px] h-[13px]" />
          {t("Límite diario")}
          {tier && (
            <span className="text-muted-foreground opacity-70">· {tier}</span>
          )}
        </span>
        <span
          style={{
            color: over
              ? "oklch(from var(--warning) calc(l - 0.15) c h)"
              : "var(--muted-foreground)",
          }}
        >
          <b className="text-foreground">{selected}</b> / {dailyLimit}{" "}
          {t("por día")}
        </span>
      </div>
      <div
        className="rounded-full overflow-hidden"
        style={{ height: 5, background: "var(--muted)" }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: over ? "var(--warning)" : "var(--primary)",
            transition: "width .2s ease",
          }}
        />
      </div>
    </div>
  );
}
