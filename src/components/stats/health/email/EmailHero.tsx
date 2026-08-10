import { ShieldAlert, ShieldCheck, ShieldX } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import type { RiskLevel } from "../healthState";
import { Chip, formatNumber, formatPercent, TONE } from "../primitives";
import type { EmailAggregate } from "./emailMetrics";
import type { EmailHealthIssue, EmailHealthState } from "./emailHealthState";
import { toneForRisk } from "./emailHealthState";

const RISK_COPY: Record<RiskLevel, { title: string; body: string }> = {
  safe: {
    title: "Sending is healthy",
    body: "Bounce and complaint rates are within the range Amazon SES considers acceptable.",
  },
  watch: {
    title: "Worth keeping an eye on",
    body: "Something is drifting toward the range where Amazon SES starts to act. Nothing is blocked yet.",
  },
  risk: {
    title: "At risk of being paused",
    body: "Amazon SES pauses senders automatically at this level. Fix the issues below before it does.",
  },
  blocked: {
    title: "Sending is paused",
    body: "Amazon SES is not delivering this account's email. Nothing will be sent until it is reinstated.",
  },
};

const RISK_ICON = {
  safe: ShieldCheck,
  watch: ShieldAlert,
  risk: ShieldAlert,
  blocked: ShieldX,
} as const;

/**
 * The verdict, above everything else.
 *
 * The whole point of this page is that a customer should never have to work out
 * from four charts whether they are about to be cut off. One sentence answers
 * it, and the two rates that decide it sit directly underneath.
 */
export default function EmailHero({
  state,
  risk,
  issues,
  current,
}: {
  state: EmailHealthState | null;
  risk: RiskLevel;
  issues: EmailHealthIssue[];
  current: EmailAggregate;
}) {
  const { translate: t } = useTranslation();
  const tone = toneForRisk(risk);
  const Icon = RISK_ICON[risk];
  const copy = RISK_COPY[risk];
  const highCount = issues.filter((i) => i.severity === "high").length;

  return (
    <section
      className={`border border-border rounded-[16px] p-[20px] ${TONE[tone].tint}`}
    >
      <div className="flex items-start gap-[12px]">
        <span className="rounded-full bg-background/70 p-[9px] shrink-0">
          <Icon className={`w-[20px] h-[20px] ${TONE[tone].text}`} />
        </span>
        <div className="min-w-0 grow">
          <div className="flex items-center gap-[8px] flex-wrap">
            <h3 className={`text-[16px] font-semibold m-0 ${TONE[tone].text}`}>
              {t(copy.title)}
            </h3>
            {highCount > 0 && (
              <Chip tone="destructive" dot>
                {highCount} {t("to fix")}
              </Chip>
            )}
            {state?.sendingStatus && (
              <Chip tone={risk === "blocked" ? "destructive" : "neutral"}>
                {state.sendingStatus}
              </Chip>
            )}
          </div>
          <p className="text-[12.5px] text-muted-foreground mt-[4px] leading-relaxed m-0">
            {t(copy.body)}
          </p>

          <div className="flex gap-[24px] mt-[14px] flex-wrap">
            <HeroStat
              label={t("Sent")}
              value={formatNumber(current.sent)}
              note={t("in this period")}
            />
            {/* Three decimals, not the usual zero: the entire decision range for
                a complaint rate lives between 0.0% and 0.5%, so rounding to a
                whole percent would render every state as "0%". */}
            <HeroStat
              label={t("Spam reports")}
              value={formatPercent(current.complaintRate, 3)}
              note={`${formatNumber(current.complained)} ${t("reports")}`}
            />
            <HeroStat
              label={t("Bounced")}
              value={formatPercent(current.bounceRate, 2)}
              note={`${formatNumber(current.bounced)} ${t("addresses")}`}
            />
            {state?.suppressedCount != null && (
              <HeroStat
                label={t("Blocked addresses")}
                value={formatNumber(state.suppressedCount)}
                note={t("held by Amazon SES")}
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroStat({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="text-[20px] font-semibold tabular-nums leading-tight">
        {value}
      </div>
      <div className="text-[11px] text-muted-foreground">{note}</div>
    </div>
  );
}
