import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTranslation } from "@/hooks/useTranslation";
import { COLD_RATIO_CRITICAL, COLD_RATIO_WARN } from "./healthState";
import type { DayMetrics } from "./metrics";
import { dayLabel } from "./metrics";
import { Card, CardHead, formatNumber, formatPercent } from "./primitives";
import { EmptyChart } from "./VolumeChart";

/**
 * Share of each day's recipients who never messaged this number first.
 *
 * The single metric that best predicts a lock, which is why it gets its own
 * chart rather than a tile: what matters is whether the *trend* is crossing the
 * safe line, not today's value.
 */
export default function ColdChart({ days }: { days: DayMetrics[] }) {
  const { translate: t } = useTranslation();

  const data = days.map((d) => ({
    label: dayLabel(d.day),
    day: d.day,
    ratio: d.cold_recipient_ratio,
    cold: d.cold_recipient_count,
    recipients: d.recipient_count,
  }));

  const hasRecipients = days.some((d) => d.recipient_count > 0);

  const barColor = (ratio: number) =>
    ratio > COLD_RATIO_CRITICAL
      ? "var(--destructive)"
      : ratio > COLD_RATIO_WARN
        ? "var(--warning)"
        : "var(--success)";

  return (
    <Card>
      <CardHead
        title={t("Cold recipients")}
        note={t("Share of each day's recipients who never messaged you first")}
      />
      {!hasRecipients ? (
        <EmptyChart label={t("No recipients in this window")} />
      ) : (
        <div dir="ltr">
          <ResponsiveContainer width="100%" height={160}>
            <BarChart
              data={data}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              barCategoryGap={1}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                opacity={0.3}
                vertical={false}
              />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={18} />
              <YAxis
                tick={{ fontSize: 11 }}
                width={48}
                domain={[0, (max: number) => Math.max(0.6, max)]}
                tickFormatter={(v: number) => formatPercent(v)}
              />
              <ReferenceLine
                y={COLD_RATIO_WARN}
                stroke="var(--muted-foreground)"
                strokeDasharray="4 4"
                label={{
                  value: `${t("safe")} ≤ ${formatPercent(COLD_RATIO_WARN)}`,
                  position: "insideTopLeft",
                  fontSize: 10,
                  fill: "var(--muted-foreground)",
                }}
              />
              <Tooltip
                cursor={{ fill: "var(--accent)", opacity: 0.4 }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload as (typeof data)[number];
                  return (
                    <div className="bg-popover border border-border rounded-[10px] px-[10px] py-[8px] text-[12px] shadow-sm">
                      <div className="font-medium">{d.label}</div>
                      <div className="text-muted-foreground mt-[2px]">
                        {formatPercent(d.ratio)} {t("of")}{" "}
                        {formatNumber(d.recipients)} {t("recipients")}
                      </div>
                    </div>
                  );
                }}
              />
              <Bar dataKey="ratio" radius={[3, 3, 0, 0]}>
                {data.map((d) => (
                  <Cell key={d.day} fill={barColor(d.ratio)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
