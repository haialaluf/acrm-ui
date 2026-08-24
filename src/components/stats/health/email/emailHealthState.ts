import type { EmailHealthSnapshotRow } from "@/queries/useEmailHealth";
import type { EmailAggregate, EmailDayMetrics } from "./emailMetrics";
import { aggregateEmail } from "./emailMetrics";
import type { RiskLevel, Severity } from "../healthState";
import type { Tone } from "../primitives";

/**
 * Thresholds the issue rules fire on.
 *
 * These are not house style — they are Amazon's. AWS publishes two levels per
 * metric, and the difference matters: "under review" is automatic and
 * recoverable, "may pause" stops delivery.
 *
 *   Bounce rate:    review at 5%,   pause at 10%
 *   Complaint rate: review at 0.1%, pause at 0.5%
 *
 * The asymmetry is the single most misunderstood thing about deliverability:
 * one spam report per two hundred sends can pause an account, where it takes
 * one bounce in ten to do the same. So the complaint constants sit exactly on
 * AWS's two levels — there is no room to warn late — while the bounce ones sit
 * deliberately below, WARN at 2% so the page is read before AWS looks at all.
 */
export const BOUNCE_RATE_WARN = 0.02;
/** AWS's *review* threshold, not its pause threshold (which is 10%). */
export const BOUNCE_RATE_CRITICAL = 0.05;
/** AWS's review threshold. */
export const COMPLAINT_RATE_WARN = 0.001;
/** AWS's *pause* threshold — sending can stop here. */
export const COMPLAINT_RATE_CRITICAL = 0.005;

/**
 * Below this many sends, a rate is noise and no rule fires on it.
 *
 * One bounce out of three sends is a 33% bounce rate and means nothing. SES
 * applies the same idea — its findings require "a representative volume" — so
 * without this the page would scream at every organization's first test send.
 */
export const MIN_VOLUME_FOR_RATES = 50;

/** Rules look at the last week: a 90-day average hides a collapse that started
 *  on Monday. */
export const RULE_WINDOW_DAYS = 7;

/** SES sending statuses that mean nothing can currently be delivered. */
const BLOCKED_STATUSES = new Set(["PAUSED", "ENFORCED", "DISABLED"]);

export type EmailReputationFinding = {
  type: string | null;
  impact: string | null;
  description: string | null;
};

export type EmailHealthState = {
  organizationAddress: string | null;
  tenantName: string | null;
  /** ENABLED | PAUSED | ENFORCED | REINSTATED. */
  sendingStatus: string | null;
  /** 'none' | 'low' | 'high', SES's worst open finding. */
  reputationStatus: string | null;
  findings: EmailReputationFinding[];
  suppressedCount: number | null;
  lastCheckedAt: string | null;
  lastSource: string | null;
};

export type EmailHealthIssue = {
  key: string;
  severity: Severity;
  title: string;
  detail: string;
  /** The recommended action. */
  fix: string;
  /** Which underlying parameter this came from, for the curious. */
  meta: string;
};

type Translate = (text: string) => string;

//===================================
// Reading snapshots
//===================================

const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);

function parseFindings(value: unknown): EmailReputationFinding[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry) => {
    if (!isRecord(entry)) return [];

    return [
      {
        type: typeof entry.Type === "string" ? entry.Type : null,
        impact: typeof entry.Impact === "string" ? entry.Impact : null,
        description:
          typeof entry.Description === "string" ? entry.Description : null,
      },
    ];
  });
}

/**
 * Current state, folded from the snapshot window newest-first.
 *
 * Field-by-field rather than "take the newest row": a webhook row records that
 * a bounce happened and carries no `sending_status`, so taking the latest row
 * wholesale would blank out SES's verdict every time a single message bounced.
 */
export function coalesceEmailHealth(
  snapshots: EmailHealthSnapshotRow[],
): EmailHealthState | null {
  if (!snapshots.length) return null;

  const newest = snapshots[0];
  const firstOf = <T>(
    pick: (row: EmailHealthSnapshotRow) => T | null,
  ): T | null => snapshots.map(pick).find((v) => v != null) ?? null;

  const findingsRow = snapshots.find((row) => row.findings != null);

  return {
    organizationAddress: newest.organization_address,
    tenantName: firstOf((row) => row.tenant_name),
    sendingStatus: firstOf((row) => row.sending_status),
    reputationStatus: firstOf((row) => row.reputation_status),
    findings: parseFindings(findingsRow?.findings),
    suppressedCount: firstOf((row) => row.suppressed_count),
    // The freshness of the *page*, so it must come from the newest row of any
    // kind, not from whichever row happened to carry a sending status.
    lastCheckedAt: newest.created_at,
    lastSource: newest.source,
  };
}

//===================================
// Verdict
//===================================

export function isBlocked(state: EmailHealthState | null): boolean {
  return BLOCKED_STATUSES.has(state?.sendingStatus ?? "");
}

export function deriveEmailRisk(
  state: EmailHealthState | null,
  issues: EmailHealthIssue[],
): RiskLevel {
  // Not a judgement call: SES has stopped delivering this organization's mail.
  if (isBlocked(state)) return "blocked";
  if (state?.reputationStatus === "high") return "risk";
  if (issues.some((i) => i.severity === "high")) return "risk";
  if (issues.length > 0 || state?.reputationStatus === "low") return "watch";

  return "safe";
}

export function toneForRisk(risk: RiskLevel): Tone {
  if (risk === "blocked" || risk === "risk") return "destructive";
  if (risk === "watch") return "warning";

  return "success";
}

/** Colour for a SES sending status, used by the facts panel. */
export function toneForSendingStatus(status: string | null): Tone {
  if (!status) return "neutral";
  if (BLOCKED_STATUSES.has(status)) return "destructive";
  if (status === "REINSTATED") return "warning";
  if (status === "ENABLED") return "success";

  return "neutral";
}

export function toneForReputation(status: string | null): Tone {
  if (status === "high") return "destructive";
  if (status === "low") return "warning";
  if (status === "none") return "success";

  return "neutral";
}

//===================================
// Issue rules
//===================================

/**
 * Everything wrong with this domain's sending, worst first.
 *
 * Every issue carries a `fix`, because a deliverability warning without an
 * action is just anxiety — and unlike most metrics on this page, the fixes here
 * are genuinely actionable (stop importing purchased lists, re-confirm an old
 * list, slow down).
 */
export function buildEmailHealthIssues(
  state: EmailHealthState | null,
  days: EmailDayMetrics[],
  t: Translate,
): EmailHealthIssue[] {
  const issues: EmailHealthIssue[] = [];
  const recent = days.slice(-RULE_WINDOW_DAYS);
  const window: EmailAggregate = aggregateEmail(recent);

  if (isBlocked(state)) {
    issues.push({
      key: "sending_paused",
      severity: "high",
      title: t("Amazon SES has paused your email sending"),
      detail: t(
        "No email is being delivered. SES pauses a sender automatically when its bounce or complaint rate stays above the acceptable range, and sending stays off until the cause is resolved.",
      ),
      fix: t(
        "Clean your recipient list, then contact support to request that sending be reinstated. Sending again before fixing the cause will pause it a second time.",
      ),
      meta: `sending_status: ${state?.sendingStatus}`,
    });
  }

  // SES's own findings come first among the rate rules: they are the actual
  // trigger for enforcement, computed on SES's side over its own window, so
  // they outrank anything derived here from our copy of the data.
  for (const finding of state?.findings ?? []) {
    issues.push({
      key: `finding_${finding.type ?? "unknown"}`,
      severity: finding.impact === "HIGH" ? "high" : "medium",
      title:
        finding.impact === "HIGH"
          ? t("Amazon SES reported a serious deliverability problem")
          : t("Amazon SES reported a deliverability warning"),
      detail: finding.description ?? t("No further detail was provided."),
      fix: t(
        "Resolve this before it escalates. A high-severity finding pauses sending automatically.",
      ),
      meta: `finding: ${finding.type ?? "unknown"} (${finding.impact ?? "?"})`,
    });
  }

  // Below the volume floor every rate is noise — see MIN_VOLUME_FOR_RATES.
  if (window.sent >= MIN_VOLUME_FOR_RATES) {
    if (window.complaintRate >= COMPLAINT_RATE_WARN) {
      const critical = window.complaintRate >= COMPLAINT_RATE_CRITICAL;

      issues.push({
        key: "complaint_rate",
        severity: critical ? "high" : "medium",
        title: critical
          ? t("Too many recipients are reporting your email as spam")
          : t("Your spam-complaint rate is above the safe range"),
        detail: critical
          ? t(
              "At 0.5% — one report per two hundred emails — Amazon SES may stop this account from sending at all. That is twenty times stricter than the equivalent bounce threshold.",
            )
          : t(
              "Amazon SES places senders under review at a complaint rate of 0.1%, far lower than most people expect: roughly one report per thousand emails.",
            ),
        fix: t(
          "Only email people who asked to hear from you, make the unsubscribe link easy to find, and reduce how often you send.",
        ),
        meta: `complaint_rate: ${(window.complaintRate * 100).toFixed(3)}% over ${window.sent} sends`,
      });
    }

    if (window.bounceRate >= BOUNCE_RATE_WARN) {
      const critical = window.bounceRate >= BOUNCE_RATE_CRITICAL;

      issues.push({
        key: "bounce_rate",
        severity: critical ? "high" : "medium",
        title: critical
          ? t("Too many of your emails are bouncing")
          : t("Your bounce rate is above the safe range"),
        detail: critical
          ? t(
              "Amazon SES places senders under review at 5%, and may stop this account from sending at 10%. A hard bounce means the address does not exist.",
            )
          : t(
              "A hard bounce means the address does not exist. A high rate tells mailbox providers the list was not collected from real, willing recipients.",
            ),
        fix: t(
          "Stop importing bought or scraped lists, and remove addresses that have never opened anything.",
        ),
        meta: `bounce_rate: ${(window.bounceRate * 100).toFixed(2)}% over ${window.sent} sends`,
      });
    }
  }

  const order: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

  return issues.sort((a, b) => order[a.severity] - order[b.severity]);
}
