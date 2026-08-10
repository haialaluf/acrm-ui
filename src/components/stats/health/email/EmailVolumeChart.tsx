import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTranslation } from "@/hooks/useTranslation";
import { dayLabel } from "../metrics";
import { Card, CardHead, formatNumber, TONE_VAR } from "../primitives";
import type { EmailDayMetrics } from "./emailMetrics";

/**
 * Daily volume, split by outcome.
 *
 * Stacked rather than several series, because the question is "of what I sent
 * that day, how much landed" — a composition, not a comparison. Each segment is
 * the remainder of the one above it: `status` accumulates, so a bounced message
 * also carries `failed`, and stacking the raw counts would double-count it.
 *
 * Spam reports are deliberately absent from the stack. A complaint is not an
 * outcome of delivery — the message *was* delivered, and the recipient then
 * reported it — so it belongs to neither the delivered nor the failed segment.
 * It gets its own row of numbers below instead, where it cannot be read as a
 * share of volume.
 */
export default function EmailVolumeChart({
  days,
}: {
  days: EmailDayMetrics[];
}) {
  const { translate: t } = useTranslation();

  const data = days.map((d) => {
    const bounced = d.bounced_count + d.soft_bounced_count;
    // Everything that failed for a reason that is not a bounce: a rejection, a
    // rendering failure, a recipient we declined to mail.
    const otherFailed = Math.max(0, d.failed_count - bounced);
    // Accepted by SES but with no delivery event yet — in flight, or an event
    // that never arrived.
    const pending = Math.max(
      0,
      d.sent_count - d.delivered_count - bounced - otherFailed,
    );

    return {
      label: dayLabel(d.day),
      day: d.day,
      delivered: d.delivered_count,
      pending,
      bounced,
      otherFailed,
      complained: d.complained_count,
      sent: d.sent_count,
    };
  });

  const total = data.reduce((n, d) => n + d.sent, 0);
  const complaints = data.reduce((n, d) => n + d.complained, 0);

  const segments = [
    { key: "delivered", label: t("Delivered"), color: TONE_VAR.success },
    { key: "pending", label: t("No response yet"), color: TONE_VAR.neutral },
    { key: "bounced", label: t("Bounced"), color: TONE_VAR.destructive },
    { key: "otherFailed", label: t("Other failures"), color: TONE_VAR.warning },
  ] as const;

  return (
    <Card>
      <CardHead
        title={t("Volume")}
        note={`${formatNumber(total)} ${t("sent")}${
          complaints > 0
            ? ` · ${formatNumber(complaints)} ${t("spam reports")}`
            : ""
        }`}
      />
      {total === 0 ? (
        <div className="text-[13px] text-muted-foreground py-[8px]">
          {t("No email sent in this period.")}
        </div>
      ) : (
        <>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                  minTickGap={16}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                  width={36}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  labelFormatter={(label) => `${t("Day")} ${label}`}
                />
                {segments.map((segment) => (
                  <Bar
                    key={segment.key}
                    dataKey={segment.key}
                    name={segment.label}
                    stackId="volume"
                    fill={segment.color}
                    radius={segment.key === "delivered" ? [0, 0, 0, 0] : 0}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-[14px] flex-wrap mt-[10px]">
            {segments.map((segment) => (
              <span
                key={segment.key}
                className="inline-flex items-center gap-[6px] text-[11.5px] text-muted-foreground"
              >
                <span
                  className="rounded-[3px] w-[9px] h-[9px] inline-block"
                  style={{ background: segment.color }}
                />
                {segment.label}
              </span>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}
