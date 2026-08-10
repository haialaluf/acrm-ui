import { useTranslation } from "@/hooks/useTranslation";
import {
  Card,
  CardHead,
  Delta,
  formatNumber,
  formatPercent,
  TONE,
  type Tone,
} from "../primitives";
import type { EmailAggregate } from "./emailMetrics";
import {
  BOUNCE_RATE_CRITICAL,
  BOUNCE_RATE_WARN,
  COMPLAINT_RATE_CRITICAL,
  COMPLAINT_RATE_WARN,
  MIN_VOLUME_FOR_RATES,
} from "./emailHealthState";

function rateTone(
  value: number,
  warn: number,
  critical: number,
  enoughVolume: boolean,
): Tone {
  if (!enoughVolume) return "neutral";
  if (value >= critical) return "destructive";
  if (value >= warn) return "warning";

  return "success";
}

/**
 * The four rates, with the two that decide enforcement coloured against SES's
 * own thresholds rather than against each other.
 *
 * Bounce and complaint rates are deliberately NOT drawn on a shared scale
 * anywhere on this page: a "bad" complaint rate is 0.1% and a "bad" bounce rate
 * is 5%, so any shared axis renders the complaint rate as a flat line at zero
 * right up until the account is paused.
 */
export default function EmailRateTiles({
  current,
  previous,
}: {
  current: EmailAggregate;
  previous: EmailAggregate | null;
}) {
  const { translate: t } = useTranslation();
  const enoughVolume = current.sent >= MIN_VOLUME_FOR_RATES;

  const tiles = [
    {
      key: "delivered",
      label: t("Delivered"),
      value: current.deliveredRate,
      digits: 1,
      count: current.delivered,
      previous: previous?.deliveredRate,
      tone: "success" as Tone,
      invert: false,
    },
    {
      key: "opened",
      label: t("Opened"),
      value: current.openRate,
      digits: 1,
      count: current.opened,
      previous: previous?.openRate,
      tone: "primary" as Tone,
      invert: false,
      // Tracking pixels are blocked by plenty of clients, so a low open rate is
      // not evidence of anything. Said out loud so it is not read as one.
      note: t("Under-reported — many clients block tracking"),
    },
    {
      key: "bounced",
      label: t("Bounced"),
      value: current.bounceRate,
      digits: 2,
      count: current.bounced,
      previous: previous?.bounceRate,
      tone: rateTone(
        current.bounceRate,
        BOUNCE_RATE_WARN,
        BOUNCE_RATE_CRITICAL,
        enoughVolume,
      ),
      invert: true,
      note: `${t("SES reviews at")} ${formatPercent(BOUNCE_RATE_CRITICAL, 0)}`,
    },
    {
      key: "complained",
      label: t("Spam reports"),
      value: current.complaintRate,
      digits: 3,
      count: current.complained,
      previous: previous?.complaintRate,
      tone: rateTone(
        current.complaintRate,
        COMPLAINT_RATE_WARN,
        COMPLAINT_RATE_CRITICAL,
        enoughVolume,
      ),
      invert: true,
      note: `${t("SES reviews at")} ${formatPercent(COMPLAINT_RATE_WARN, 1)}`,
    },
  ];

  return (
    <Card>
      <CardHead
        title={t("Deliverability")}
        note={
          enoughVolume
            ? undefined
            : `${t("Too few sends to judge")} — ${formatNumber(current.sent)}/${MIN_VOLUME_FOR_RATES}`
        }
      />
      <div className="grid grid-cols-2 @2xl:grid-cols-4 gap-[12px]">
        {tiles.map((tile) => (
          <div key={tile.key} className="min-w-0">
            <div className="text-[11.5px] text-muted-foreground">
              {tile.label}
            </div>
            <div className="flex items-baseline gap-[8px] flex-wrap">
              <span
                className={`text-[22px] font-semibold tabular-nums ${TONE[tile.tone].text}`}
              >
                {formatPercent(tile.value, tile.digits)}
              </span>
              <Delta
                now={tile.value}
                prev={previous ? tile.previous : null}
                invert={tile.invert}
                flatLabel={t("flat")}
              />
            </div>
            <div className="text-[11px] text-muted-foreground">
              {formatNumber(tile.count)} {t("of")} {formatNumber(current.sent)}
            </div>
            {tile.note && (
              <div className="text-[10.5px] text-muted-foreground mt-[2px] leading-snug">
                {tile.note}
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
