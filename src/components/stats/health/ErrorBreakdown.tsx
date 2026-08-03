import { useTranslation } from "@/hooks/useTranslation";
import { errorMeta } from "./errorCodes";
import type { MetricsAggregate } from "./metrics";
import { Card, CardHead, Ltr, formatNumber, formatPercent } from "./primitives";

/**
 * Why messages failed, biggest cause first.
 *
 * The count matters less than the mix: 200 failures that are all 131047
 * (expired window) is a scheduling bug, while 200 that are all 131049 is Meta
 * throttling you — opposite problems with opposite fixes.
 */
export default function ErrorBreakdown({
  aggregate,
}: {
  aggregate: MetricsAggregate;
}) {
  const { translate: t } = useTranslation();

  const rows = Object.entries(aggregate.errors).sort((a, b) => b[1] - a[1]);
  if (!rows.length) return null;

  const total = rows.reduce((sum, [, n]) => sum + n, 0);

  return (
    <Card>
      <CardHead
        title={t("Why messages failed")}
        note={`${formatNumber(total)} ${t("failures in this window")}`}
      />
      <div className="flex flex-col">
        {rows.map(([code, count], i) => {
          const meta = errorMeta(code);
          return (
            <div
              key={code}
              className={`flex items-start gap-[14px] py-[11px] ${i ? "border-t border-border" : ""}`}
            >
              <Ltr className="text-[12px] shrink-0 rounded-[6px] px-[8px] py-[3px] bg-muted text-muted-foreground font-mono">
                {code}
              </Ltr>
              <div className="grow min-w-0">
                <div className="text-[13px]">{t(meta.title)}</div>
                <div className="text-[12px] mt-[2px] text-muted-foreground leading-snug">
                  {t(meta.hint)}
                </div>
                <div className="mt-[7px] rounded-full overflow-hidden h-[4px] bg-muted">
                  <div
                    className="h-full bg-destructive/75"
                    style={{ width: `${(count / total) * 100}%` }}
                  />
                </div>
              </div>
              <div className="text-end shrink-0">
                <div className="text-[15px] font-semibold tabular-nums">
                  {formatNumber(count)}
                </div>
                <div className="text-[11px] text-muted-foreground tabular-nums">
                  {formatPercent(count / total)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
