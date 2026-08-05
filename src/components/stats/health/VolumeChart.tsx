import {
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTranslation } from "@/hooks/useTranslation";
import type { DayMetrics } from "./metrics";
import { dayLabel } from "./metrics";
import { Card, CardHead, formatNumber, formatPercent } from "./primitives";

/**
 * Daily send volume, split by outcome.
 *
 * Stacked rather than three series: the question is "of what I sent that day,
 * how much landed and got read", which is a composition, not a comparison. The
 * cap line and the outline on pinned days are the two things that make a
 * volume chart diagnostic instead of decorative.
 */
export default function VolumeChart({ days }: { days: DayMetrics[] }) {
  const { translate: t } = useTranslation();

  const cap =
    [...days].reverse().find((d) => d.messaging_limit != null)
      ?.messaging_limit ?? null;
  const pinnedDays = days.filter((d) => d.volume_pinned_to_ceiling).length;

  const data = days.map((d) => ({
    label: dayLabel(d.day),
    day: d.day,
    read: d.read_count,
    // Each segment is the remainder of the one above it — `status` accumulates,
    // so a read message also carries `delivered` and stacking the raw counts
    // would double-count it. Messages Meta never sent a receipt for get their
    // own segment rather than being dropped, so the stack really does sum to
    // the day's outgoing count as the card title claims.
    deliveredNotRead: Math.max(0, d.delivered_count - d.read_count),
    noReceipt: Math.max(
      0,
      d.outgoing_count - d.delivered_count - d.failed_count,
    ),
    failed: d.failed_count,
    outgoing: d.outgoing_count,
    // Sent from the WhatsApp Business app. These make up most of the noReceipt
    // segment on a coexistence account and are the reason it exists: Meta sends
    // no status webhooks for them, so they can never move out of it.
    appSent: Math.max(0, d.outgoing_count - d.receipt_eligible_count),
    deliveredRate: d.delivered_rate,
    readRate: d.read_rate,
    pinned: d.volume_pinned_to_ceiling,
  }));

  const hasVolume = days.some((d) => d.outgoing_count > 0);

  const note = cap
    ? `${t("Cap in force")}: ${formatNumber(cap)}/${t("day")} · ${pinnedDays} ${
        pinnedDays === 1
          ? t("day pinned to the cap")
          : t("days pinned to the cap")
      }`
    : t("No cap reported yet — the health check has not run for this number.");

  return (
    <Card>
      <CardHead title={t("Messages sent per day")} note={note} />
      {!hasVolume ? (
        <EmptyChart label={t("No messages sent in this window")} />
      ) : (
        <div dir="ltr">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={data}
              margin={{ top: 8, right: 8, left: -18, bottom: 0 }}
              barCategoryGap={1}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                opacity={0.3}
                vertical={false}
              />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={18} />
              <YAxis tick={{ fontSize: 11 }} width={48} />
              {cap != null && (
                <ReferenceLine
                  y={cap}
                  stroke="var(--destructive)"
                  strokeDasharray="4 4"
                  label={{
                    value: `${t("cap")} ${formatNumber(cap)}`,
                    position: "insideTopLeft",
                    fontSize: 10,
                    fill: "var(--muted-foreground)",
                  }}
                />
              )}
              <Tooltip
                cursor={{ fill: "var(--accent)", opacity: 0.4 }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload as (typeof data)[number];
                  return (
                    <div className="bg-popover border border-border rounded-[10px] px-[10px] py-[8px] text-[12px] shadow-sm">
                      <div className="font-medium">{d.label}</div>
                      <div className="text-muted-foreground mt-[2px]">
                        {formatNumber(d.outgoing)} {t("sent")} ·{" "}
                        {formatPercent(d.deliveredRate)} {t("delivered")} ·{" "}
                        {formatPercent(d.readRate)} {t("read")}
                      </div>
                      {d.noReceipt > 0 && (
                        <div className="text-muted-foreground mt-[2px]">
                          {formatNumber(d.noReceipt)} {t("with no receipt")}
                          {d.appSent > 0 &&
                            ` · ${formatNumber(d.appSent)} ${t("sent from the WhatsApp app")}`}
                        </div>
                      )}
                      {d.failed > 0 && (
                        <div className="text-destructive-strong mt-[2px]">
                          {formatNumber(d.failed)} {t("failed")}
                        </div>
                      )}
                      {d.pinned && (
                        <div className="text-destructive-strong mt-[2px]">
                          {t("Hit the cap")}
                        </div>
                      )}
                    </div>
                  );
                }}
              />
              <Bar dataKey="failed" stackId="v" fill="var(--destructive)" />
              <Bar
                dataKey="noReceipt"
                stackId="v"
                fill="var(--muted-foreground)"
                fillOpacity={0.35}
              />
              <Bar
                dataKey="deliveredNotRead"
                stackId="v"
                fill="var(--primary)"
                fillOpacity={0.28}
              />
              <Bar
                dataKey="read"
                stackId="v"
                fill="var(--primary)"
                radius={[3, 3, 0, 0]}
              >
                {data.map((d) => (
                  <Cell
                    key={d.day}
                    stroke={d.pinned ? "var(--destructive)" : undefined}
                    strokeWidth={d.pinned ? 1 : 0}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="flex items-center gap-[14px] text-[11px] text-muted-foreground mt-[10px] flex-wrap">
        <Legend color="var(--primary)" label={t("Read")} />
        <Legend
          color="color-mix(in oklab, var(--primary) 28%, transparent)"
          label={t("Delivered, not read")}
        />
        <Legend
          color="color-mix(in oklab, var(--muted-foreground) 35%, transparent)"
          label={t("No receipt")}
        />
        <Legend color="var(--destructive)" label={t("Failed")} />
      </div>
    </Card>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-[5px]">
      <span
        className="rounded-[2px] inline-block w-[9px] h-[9px]"
        style={{ background: color }}
      />
      {label}
    </span>
  );
}

export function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center h-[160px] text-muted-foreground text-[13px]">
      {label}
    </div>
  );
}
