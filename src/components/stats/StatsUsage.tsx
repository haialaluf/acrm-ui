import { useTranslation } from "@/hooks/useTranslation";
import {
  useProducts,
  useUsageHistory,
  useTierLimits,
} from "@/queries/useBilling";
import UsageChart from "./UsageChart";
import StatsPanel from "./StatsPanel";

function translateProductName(name: string, t: (s: string) => string) {
  switch (name) {
    case "Messages":
      return t("Messages");
    case "Conversations":
      return t("Conversations");
    case "Storage":
      return t("Storage");
    case "AI Credits":
      return t("AI Credits");
    default:
      return name;
  }
}

function formatMonth(period: string, t: (s: string) => string) {
  const names = [
    t("Jan"),
    t("Feb"),
    t("Mar"),
    t("Apr"),
    t("May"),
    t("Jun"),
    t("Jul"),
    t("Aug"),
    t("Sep"),
    t("Oct"),
    t("Nov"),
    t("Dec"),
  ];
  const m = parseInt(period.slice(5, 7), 10);
  return names[m - 1] || period.slice(5, 7);
}

function formatDay(period: string) {
  return period.slice(8, 10);
}

function isoDate(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function last14Days(): string[] {
  const days: string[] = [];
  const d = new Date();
  for (let i = 13; i >= 0; i--) {
    const dt = new Date(d);
    dt.setDate(d.getDate() - i);
    days.push(isoDate(dt));
  }
  return days;
}

function last12Months(): string[] {
  const months: string[] = [];
  const d = new Date();
  for (let i = 11; i >= 0; i--) {
    months.push(isoDate(new Date(d.getFullYear(), d.getMonth() - i, 1)));
  }
  return months;
}

/** @param carry hold the last known value through periods with no row. Only
 *  correct for a gauge, whose series is a standing total that stays put until
 *  something changes it. A counter or a balance that reports nothing for a
 *  period genuinely did nothing that period, and reads as zero. */
function fillSeries(
  periods: string[],
  usage: { period: string; product_id: string; quantity: number }[] | undefined,
  productId: string,
  carry = false,
): { period: string; quantity: number }[] {
  const map = new Map<string, number>();
  // Seed the carried value from the newest row *before* the window, so a gauge
  // whose last change predates it charts its standing total instead of zero.
  let last = 0;
  let seed: string | null = null;
  for (const row of usage ?? []) {
    if (row.product_id !== productId) continue;
    map.set(row.period, row.quantity);
    if (row.period < periods[0] && (seed === null || row.period > seed)) {
      seed = row.period;
      last = row.quantity;
    }
  }
  return periods.map((p) => {
    const val = map.get(p);
    if (val != null) {
      last = val;
      return { period: p, quantity: val };
    }
    return { period: p, quantity: carry ? last : 0 };
  });
}

export default function StatsUsage() {
  const { translate: t } = useTranslation();
  const { data: products } = useProducts();
  const { data: dayUsage } = useUsageHistory("day");
  const { data: monthUsage } = useUsageHistory("month");
  const { data: tierLimits } = useTierLimits();

  const tierSet = new Set(tierLimits?.map((tl) => tl.product_id));
  const visibleProducts = products?.filter((p) => tierSet.has(p.id));

  const days = last14Days();
  const months = last12Months();

  return (
    <StatsPanel title={t("Usage")}>
      <div className="flex flex-col gap-[32px]">
        {visibleProducts?.map((product) => {
          const name = translateProductName(product.name, t);
          const carry = product.kind === "gauge";
          return (
            <div key={product.id} className="flex flex-col gap-[8px]">
              <h3 className="text-[16px] font-medium text-foreground">
                {name}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-[16px]">
                <div className="flex flex-col gap-[4px]">
                  <span className="text-[13px] text-muted-foreground">
                    {t("Last 12 months")}
                  </span>
                  <UsageChart
                    data={fillSeries(months, monthUsage, product.id, carry)}
                    unit={product.unit}
                    periodLabel={t("Month")}
                    formatLabel={(p) => formatMonth(p, t)}
                  />
                </div>
                <div className="flex flex-col gap-[4px]">
                  <span className="text-[13px] text-muted-foreground">
                    {t("Last 14 days")}
                  </span>
                  <UsageChart
                    data={fillSeries(days, dayUsage, product.id, carry)}
                    unit={product.unit}
                    periodLabel={t("Day")}
                    formatLabel={formatDay}
                  />
                </div>
              </div>
            </div>
          );
        })}
        {!visibleProducts?.length && (
          <div className="text-muted-foreground text-center py-[40px]">
            {t("No usage data")}
          </div>
        )}
      </div>
    </StatsPanel>
  );
}
