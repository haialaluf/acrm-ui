import type { ReactNode } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import {
  formatTier,
  humanizeEnum,
  riskSummary,
  toneFor,
  type AccountHealthState,
  type HealthIssue,
  type RiskLevel,
} from "./healthState";
import type { MetricsAggregate } from "./metrics";
import type { WabaSpend } from "@/queries/useWabaSpend";
import {
  TONE,
  formatCurrency,
  formatNumber,
  type Tone,
} from "./primitives";

const RISK_TONE: Record<RiskLevel, Tone> = {
  safe: "success",
  watch: "warning",
  risk: "destructive",
  blocked: "destructive",
};

/**
 * The answer-first band: one verdict, then the four numbers that justify it.
 * Everything below the hero exists to explain what this says.
 */
export default function HealthHero({
  state,
  risk,
  issues,
  current,
  todayVolume,
  spend,
  spendDays,
}: {
  state: AccountHealthState | null;
  risk: RiskLevel;
  issues: HealthIssue[];
  current: MetricsAggregate;
  todayVolume: number;
  spend?: WabaSpend | null;
  spendDays: number;
}) {
  const { translate: t } = useTranslation();
  const tone = TONE[RISK_TONE[risk]];
  const { headline, sub } = riskSummary(risk, state, issues, t);

  const riskLabel: Record<RiskLevel, string> = {
    safe: t("Safe"),
    watch: t("Watch"),
    risk: t("At risk"),
    blocked: t("Blocked"),
  };

  const limit = state?.messagingLimit ?? current.limit;
  const used = limit ? Math.min(1, todayVolume / limit) : null;

  // Meta reports cost for most WABAs but withholds it from any that bills
  // through a BSP, where the tile falls back to what we can derive ourselves:
  // an estimate priced off our own send log, or failing that (no rate card
  // yet) the message count Meta will still report.
  const spendTile = spendTileContent(spend, spendDays, t);

  return (
    <section className="bg-popover border border-border rounded-[16px] overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(300px,1fr)_1.35fr]">
        <div
          className={`p-[24px] flex flex-col justify-center gap-[10px] ${tone.tint}`}
        >
          <div className="flex items-center gap-[10px]">
            <span className={`rounded-full w-[12px] h-[12px] ${tone.dot}`} />
            <span
              className={`text-[13px] font-semibold uppercase tracking-wide ${tone.text}`}
            >
              {riskLabel[risk]}
            </span>
          </div>
          <div
            className={`text-[22px] font-semibold leading-snug ${tone.text}`}
          >
            {headline}
          </div>
          <div className={`text-[13px] opacity-85 ${tone.text}`}>{sub}</div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2">
          <Tile
            label={t("Quality rating")}
            value={humanizeEnum(state?.qualityRating) || t("Unknown")}
            tone={toneFor(state?.qualityRating)}
            note={
              state?.qualityRating === "GREEN"
                ? t("Meta is happy with your sends")
                : t("Blocks and reports above normal")
            }
          />
          <Tile
            label={t("Sending status")}
            value={humanizeEnum(state?.canSendMessage) || t("Unknown")}
            tone={toneFor(state?.canSendMessage)}
            note={
              state?.restrictions.length
                ? state.restrictions[0].type
                : t("No restrictions on this number")
            }
          />
          <Tile
            label={t("Daily cap")}
            value={
              limit
                ? `${formatNumber(todayVolume)} / ${formatNumber(limit)}`
                : formatNumber(todayVolume)
            }
            tone={
              used == null
                ? "neutral"
                : used > 0.95
                  ? "destructive"
                  : used > 0.8
                    ? "warning"
                    : "success"
            }
            note={
              limit
                ? `${state?.messagingLimitTier ? `${formatTier(state.messagingLimitTier)} · ` : ""}${t("at the cap on")} ${current.pinnedDays} ${current.pinnedDays === 1 ? t("day in this window") : t("days in this window")}`
                : t("No cap reported for this number yet")
            }
            bar={used}
          />
          <Tile
            label={spendTile.label}
            value={spendTile.value}
            tone="neutral"
            note={spendTile.note}
          />
        </div>
      </div>
    </section>
  );
}

/**
 * What the spend tile shows, which depends on how much Meta is willing to say.
 *
 * Three states, best first: Meta's own cost; our estimate priced from the send
 * log when Meta withholds cost from a BSP-billed number; and the bare message
 * count when there is no rate card to price that log against. Each says which
 * one it is — an estimate presented as a billed figure would be worse than no
 * figure at all.
 */
function spendTileContent(
  spend: WabaSpend | null | undefined,
  spendDays: number,
  t: (key: string) => string,
): { label: string; value: string; note: string } {
  const window = `${t("over the last")} ${spendDays} ${t("days")}`;

  if (spend?.unavailable_reason !== "billed_through_partner") {
    return {
      label: t("Amount spent"),
      value: spend?.amount == null
        ? "—"
        : formatCurrency(spend.amount, spend.currency),
      note: `${t("Meta-billed cost")} ${window}`,
    };
  }

  if (spend.estimate && spend.estimate.amount > 0) {
    const { amount, unpriced_messages } = spend.estimate;
    // Messages the rate card cannot price are left out of the total, so say
    // so — an estimate that quietly omits traffic reads as a real figure.
    const gap = unpriced_messages > 0
      ? ` · ${formatNumber(unpriced_messages)} ${t("messages have no rate yet")}`
      : "";

    return {
      label: t("Amount spent"),
      // The tilde and "Estimated" carry the caveat: this is our arithmetic
      // over our own send log, not a figure Meta ever confirmed.
      value: `${formatCurrency(amount, spend.currency)}`,
      note: `${t("Estimated Meta-billed cost")} ${window}${gap}`,
    };
  }

  // No rate card for this traffic — the message count is all we can stand
  // behind, and a $0.00 would read as "free" rather than "unpriced".
  return {
    label: t("Messages sent"),
    value: spend.volume == null ? "—" : formatNumber(spend.volume),
    note: `${t("Add a WhatsApp rate card to estimate cost")} ${window}`,
  };
}

function Tile({
  label,
  value,
  tone,
  note,
  bar,
}: {
  label: string;
  value: ReactNode;
  tone: Tone;
  note: string;
  bar?: number | null;
}) {
  const t = TONE[tone];
  return (
    <div className="p-[16px] flex flex-col gap-[5px] border-t border-s border-border">
      <div className="text-[12px] text-muted-foreground">{label}</div>
      <div className="flex items-center gap-[8px]">
        <span className={`rounded-full w-[8px] h-[8px] shrink-0 ${t.dot}`} />
        <span className={`text-[18px] font-semibold tabular-nums ${t.text}`}>
          {value}
        </span>
      </div>
      {bar != null && (
        <div className="rounded-full overflow-hidden h-[4px] bg-muted mt-[2px]">
          <div
            className={`h-full ${t.dot}`}
            style={{ width: `${bar * 100}%` }}
          />
        </div>
      )}
      <div className="text-[11.5px] text-muted-foreground leading-snug">
        {note}
      </div>
    </div>
  );
}
