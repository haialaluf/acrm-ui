import { Line, LineChart, ResponsiveContainer, YAxis } from "recharts";
import { useTranslation } from "@/hooks/useTranslation";
import type { DayMetrics, MetricsAggregate } from "./metrics";
import {
  Card,
  Delta,
  TONE_VAR,
  formatNumber,
  formatPercent,
  type Tone,
} from "./primitives";
import { TONE } from "./primitives";

type Tile = {
  label: string;
  value: string;
  now: number;
  prev: number | null;
  series: number[];
  tone: Tone;
  /** True when a rising value is bad. */
  invert: boolean;
  asPercentagePoints: boolean;
  sub: string;
};

/**
 * The four rates that describe send health, each with its own 30/90-day shape
 * and its change against the previous equal-length window. A rate without a
 * direction is not actionable — 62% read could be recovery or collapse.
 */
export default function RateTiles({
  days,
  current,
  previous,
}: {
  days: DayMetrics[];
  current: MetricsAggregate;
  previous: MetricsAggregate | null;
}) {
  const { translate: t } = useTranslation();

  const tiles: Tile[] = [
    {
      label: t("Delivered rate"),
      value: formatPercent(current.deliveredRate, 1),
      now: current.deliveredRate,
      prev: previous?.deliveredRate ?? null,
      series: days.map((d) => d.delivered_rate),
      tone: current.deliveredRate > 0.93 ? "success" : "warning",
      invert: false,
      asPercentagePoints: true,
      sub: `${formatNumber(current.delivered)} ${t("of")} ${formatNumber(current.outgoing)} ${t("sent")}`,
    },
    {
      label: t("Read rate"),
      value: formatPercent(current.readRate, 1),
      now: current.readRate,
      prev: previous?.readRate ?? null,
      series: days.map((d) => d.read_rate),
      tone:
        current.readRate > 0.5
          ? "success"
          : current.readRate > 0.35
            ? "warning"
            : "destructive",
      invert: false,
      asPercentagePoints: true,
      sub: t("A low read rate feeds quality drops"),
    },
    {
      label: t("Failure rate"),
      value: formatPercent(current.failedRate, 1),
      now: current.failedRate,
      prev: previous?.failedRate ?? null,
      series: days.map((d) =>
        d.outgoing_count > 0 ? d.failed_count / d.outgoing_count : 0,
      ),
      tone:
        current.failedRate < 0.02
          ? "success"
          : current.failedRate < 0.05
            ? "warning"
            : "destructive",
      invert: true,
      asPercentagePoints: true,
      sub: `${formatNumber(current.failed)} ${t("failed messages")}`,
    },
    {
      label: t("Replies per send"),
      value: current.ioRatio.toFixed(2),
      now: current.ioRatio,
      prev: previous?.ioRatio ?? null,
      series: days.map((d) => d.inbound_outbound_ratio),
      tone:
        current.ioRatio > 0.25
          ? "success"
          : current.ioRatio > 0.12
            ? "warning"
            : "destructive",
      invert: false,
      asPercentagePoints: false,
      sub: `${formatNumber(current.incoming)} ${t("messages received")}`,
    },
  ];

  return (
    <div className="grid gap-[12px] grid-cols-2 xl:grid-cols-4">
      {tiles.map((tile) => (
        <Card key={tile.label}>
          <div className="text-[12px] text-muted-foreground mb-[4px]">
            {tile.label}
          </div>
          <div className="flex items-baseline gap-[8px] flex-wrap">
            <span
              className={`text-[24px] font-semibold leading-tight ${TONE[tile.tone].text}`}
            >
              {tile.value}
            </span>
            <Delta
              now={tile.now}
              prev={tile.prev}
              invert={tile.invert}
              asPercentagePoints={tile.asPercentagePoints}
              flatLabel={t("flat")}
            />
          </div>
          <Sparkline values={tile.series} color={TONE_VAR[tile.tone]} />
          <div className="text-[11px] text-muted-foreground mt-[4px]">
            {tile.sub}
          </div>
        </Card>
      ))}
    </div>
  );
}

/** Shape only — no axes, no tooltip. The number above carries the value. */
function Sparkline({ values, color }: { values: number[]; color: string }) {
  const data = values.map((value, i) => ({ i, value }));
  return (
    <div className="mt-[8px]" dir="ltr" aria-hidden="true">
      <ResponsiveContainer width="100%" height={30}>
        <LineChart
          data={data}
          margin={{ top: 2, right: 0, left: 0, bottom: 2 }}
        >
          <YAxis hide domain={["dataMin", "dataMax"]} />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.6}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
