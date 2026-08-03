import type {
  HealthSnapshotRow,
  MessageTemplateRow,
} from "@/queries/useWhatsAppHealth";
import type { DayMetrics, MetricsAggregate } from "./metrics";
import { aggregate } from "./metrics";

/** Thresholds the issue rules fire on. Named so the copy and the test agree. */
export const COLD_RATIO_WARN = 0.25;
export const COLD_RATIO_CRITICAL = 0.4;
export const FAILURE_RATE_WARN = 0.05;
export const READ_RATE_WARN = 0.35;
export const PINNED_DAYS_WARN = 3;
/** Rules look at the last week, not the whole selected window: a 90-day
 *  average hides a collapse that started on Monday. */
export const RULE_WINDOW_DAYS = 7;

export type Restriction = {
  type: string;
  expiration: string | null;
};

/** One blocking issue Meta itself reported, flattened out of `health_status`. */
export type MetaIssue = {
  entity: string;
  code: number | null;
  description: string;
  solution: string | null;
};

export type AccountHealthState = {
  organizationAddress: string | null;
  wabaId: string | null;
  displayName: string | null;
  qualityRating: string | null;
  canSendMessage: string | null;
  messagingLimit: number | null;
  messagingLimitTier: string | null;
  nameStatus: string | null;
  accountReviewStatus: string | null;
  businessVerificationStatus: string | null;
  violationType: string | null;
  /** When the violation was reported — it is sticky, so the date matters. */
  violationAt: string | null;
  /** Unexpired restrictions only. */
  restrictions: Restriction[];
  metaIssues: MetaIssue[];
  lastCheckedAt: string | null;
  lastSource: string | null;
};

export type RiskLevel = "safe" | "watch" | "risk" | "blocked";
export type Severity = "high" | "medium" | "low";

export type HealthIssue = {
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

const upper = (v: string | null): string | null => v?.toUpperCase() ?? null;

function parseRestrictions(value: unknown): Restriction[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!isRecord(entry)) return [];
    const type = entry.restriction_type;
    if (typeof type !== "string") return [];
    const expiration =
      typeof entry.expiration === "string" ? entry.expiration : null;
    return [{ type, expiration }];
  });
}

function parseMetaIssues(value: unknown): MetaIssue[] {
  if (!isRecord(value) || !Array.isArray(value.entities)) return [];
  return value.entities.flatMap((entity) => {
    if (!isRecord(entity) || !Array.isArray(entity.errors)) return [];
    const entityType =
      typeof entity.entity_type === "string" ? entity.entity_type : "";
    return entity.errors.flatMap((err) => {
      if (!isRecord(err)) return [];
      const description = err.error_description;
      if (typeof description !== "string") return [];
      return [
        {
          entity: entityType,
          code: typeof err.error_code === "number" ? err.error_code : null,
          description,
          solution:
            typeof err.possible_solution === "string"
              ? err.possible_solution
              : null,
        },
      ];
    });
  });
}

/** `raw.phone.verified_name` on poll rows — the only place the display name lives. */
function parseDisplayName(raw: unknown): string | null {
  if (!isRecord(raw) || !isRecord(raw.phone)) return null;
  const name = raw.phone.verified_name;
  return typeof name === "string" ? name : null;
}

/** A restriction that has already expired is history, not a current state. */
function isActive(restriction: Restriction, now: Date): boolean {
  if (!restriction.expiration) return true; // no end date = indefinite
  const expiry = new Date(restriction.expiration);
  return Number.isNaN(expiry.getTime()) ? true : expiry > now;
}

/**
 * Current account state, assembled from several snapshots rather than one.
 *
 * The two producers write disjoint column sets: a poll row carries
 * `can_send_message`, `name_status`, review/verification status and
 * `health_status`; a webhook row carries `event_type`, `violation_type`,
 * `restriction_info` and sometimes `quality_rating`. Reading only the newest
 * row therefore shows mostly nulls whenever the last event was a webhook.
 * Each field independently takes the most recent snapshot that actually set it.
 *
 * @param snapshots newest first, as returned by `useHealthSnapshots`.
 */
export function coalesceHealth(
  snapshots: HealthSnapshotRow[],
  now: Date = new Date(),
): AccountHealthState | null {
  if (!snapshots.length) return null;

  const latest = <T>(
    pick: (row: HealthSnapshotRow) => T | null | undefined,
  ) => {
    for (const row of snapshots) {
      const value = pick(row);
      if (value !== null && value !== undefined) return value;
    }
    return null;
  };

  const violationRow =
    snapshots.find((row) => row.violation_type != null) ?? null;
  const restrictionRow =
    snapshots.find((row) => row.restriction_info != null) ?? null;
  const pollRow = snapshots.find((row) => row.source === "poll") ?? null;

  return {
    organizationAddress: latest((r) => r.organization_address),
    wabaId: latest((r) => r.waba_id),
    displayName: pollRow ? parseDisplayName(pollRow.raw) : null,
    qualityRating: upper(latest((r) => r.quality_rating)),
    canSendMessage: upper(latest((r) => r.can_send_message)),
    messagingLimit: latest((r) => r.messaging_limit),
    messagingLimitTier: latest((r) => r.messaging_limit_tier),
    nameStatus: upper(latest((r) => r.name_status)),
    accountReviewStatus: upper(latest((r) => r.account_review_status)),
    businessVerificationStatus: upper(
      latest((r) => r.business_verification_status),
    ),
    violationType: violationRow?.violation_type ?? null,
    violationAt: violationRow?.created_at ?? null,
    restrictions: parseRestrictions(restrictionRow?.restriction_info).filter(
      (r) => isActive(r, now),
    ),
    metaIssues: parseMetaIssues(latest((r) => r.health_status)),
    lastCheckedAt: snapshots[0]?.created_at ?? null,
    lastSource: snapshots[0]?.source ?? null,
  };
}

/**
 * When the 4-hourly poller runs next. Derived, not stored: the pg_cron schedule
 * fires on the hour every four hours, UTC (whatsapp_health_poll_cron migration).
 */
export function nextPollAt(now: Date = new Date()): Date {
  const next = new Date(now);
  next.setUTCMinutes(0, 0, 0);
  next.setUTCHours(next.getUTCHours() + (4 - (now.getUTCHours() % 4)));
  return next;
}

//===================================
// Risk
//===================================

export function deriveRisk(
  state: AccountHealthState | null,
  issues: HealthIssue[],
): RiskLevel {
  if (!state) return "safe";
  if (
    state.canSendMessage === "BLOCKED" ||
    state.accountReviewStatus === "REJECTED"
  )
    return "blocked";
  if (
    state.canSendMessage === "LIMITED" ||
    state.qualityRating === "RED" ||
    state.restrictions.length > 0
  )
    return "risk";
  if (issues.some((i) => i.severity === "high" || i.severity === "medium"))
    return "watch";
  return "safe";
}

/** The hero's headline and supporting line, built from the state behind them. */
export function riskSummary(
  risk: RiskLevel,
  state: AccountHealthState | null,
  issues: HealthIssue[],
  t: Translate,
): { headline: string; sub: string } {
  const urgent = issues.filter((i) => i.severity === "high").length;

  switch (risk) {
    case "blocked":
      return {
        headline: t("Sending is disabled."),
        sub:
          state?.accountReviewStatus === "REJECTED"
            ? t(
                "Meta rejected the account review. Only an appeal can restore sending.",
              )
            : t(
                "Meta has blocked this number from sending. Only an appeal can restore it.",
              ),
      };
    case "risk": {
      const restriction = state?.restrictions[0];
      return {
        headline: t("Your number is restricted."),
        sub: restriction
          ? restriction.expiration
            ? `${restriction.type} · ${t("until")} ${formatDate(restriction.expiration)}`
            : restriction.type
          : t("Quality is Red, or Meta has limited what this number can send."),
      };
    }
    case "watch":
      return {
        headline:
          urgent > 0
            ? `${urgent} ${urgent === 1 ? t("thing puts your number at risk.") : t("things put your number at risk.")}`
            : t("Worth keeping an eye on."),
        sub: t(
          "You can still send, but some signals are heading the wrong way.",
        ),
      };
    default:
      return {
        headline: t("Nothing needs your attention."),
        sub: t("No restrictions, and your sending behaviour looks healthy."),
      };
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

//===================================
// Issues
//===================================

/**
 * The "what to fix" list.
 *
 * Two sources, in priority order: what Meta explicitly reported as blocking
 * (`health_status`, restrictions, quality), then what our own sending data says
 * is *about* to become a problem — the leading indicators that move days before
 * Meta acts.
 */
export function buildHealthIssues(
  state: AccountHealthState | null,
  days: DayMetrics[],
  templates: MessageTemplateRow[],
  t: Translate,
): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const recent = aggregate(days.slice(-RULE_WINDOW_DAYS));
  const recentDayCount = Math.min(days.length, RULE_WINDOW_DAYS);
  const lastDays = `${t("Last")} ${recentDayCount} ${t("days")}`;

  if (state) {
    for (const restriction of state.restrictions) {
      issues.push({
        key: `restriction-${restriction.type}`,
        severity: "high",
        title: restriction.expiration
          ? `${restriction.type} — ${t("until")} ${formatDate(restriction.expiration)}`
          : restriction.type,
        detail: state.violationType
          ? `${t("Meta applied a restriction after a policy violation of type")} ${state.violationType}.`
          : t("Meta applied a restriction to this number."),
        fix: t(
          "Do not route restricted traffic through other template categories — that is what escalates a restriction into a permanent block.",
        ),
        meta: "restriction_info",
      });
    }

    // Meta's own blocking issues already carry a description and a suggested
    // fix, so they are passed through rather than reworded.
    for (const issue of state.metaIssues) {
      issues.push({
        key: `meta-${issue.entity}-${issue.code ?? issue.description}`,
        severity: "high",
        title: issue.description,
        detail: issue.entity
          ? `${t("Reported by Meta for")} ${issue.entity.toLowerCase().replace(/_/g, " ")}.`
          : t("Reported by Meta on the last health check."),
        fix: issue.solution ?? t("Resolve this in WhatsApp Manager."),
        meta: issue.code ? `health_status · ${issue.code}` : "health_status",
      });
    }

    if (state.qualityRating === "RED") {
      issues.push({
        key: "quality",
        severity: "high",
        title: t("Quality rating is Red"),
        detail: t(
          "Too many people blocked or reported you. Meta cuts the daily cap if this does not recover within a week.",
        ),
        fix: t(
          "Send only to people who messaged you in the last 24 hours until the rating recovers.",
        ),
        meta: "quality_rating = RED",
      });
    } else if (state.qualityRating === "YELLOW") {
      issues.push({
        key: "quality",
        severity: "high",
        title: t("Quality rating dropped to Yellow"),
        detail: t(
          "Blocks and reports are above normal. Two more bad days and Meta drops you to Red, which cuts your daily cap.",
        ),
        fix: t(
          "Pause marketing sends to cold lists for 48 hours and send only to people who wrote to you first.",
        ),
        meta: "quality_rating = YELLOW",
      });
    }
  }

  const blockedTemplates = templates.filter((tpl) => {
    const status = tpl.status?.toUpperCase();
    return (
      status === "PAUSED" || status === "DISABLED" || status === "REJECTED"
    );
  });
  if (blockedTemplates.length) {
    const names = blockedTemplates
      .slice(0, 3)
      .map((tpl) => tpl.name)
      .join(", ");
    issues.push({
      key: "templates",
      severity: "high",
      title:
        blockedTemplates.length === 1
          ? `${t("Template not sending:")} ${names}`
          : `${blockedTemplates.length} ${t("templates are not sending")}`,
      detail: `${t("Paused, disabled or rejected templates silently drop the campaigns that use them.")} ${names}`,
      fix: t(
        "Rewrite and resubmit them, or switch those campaigns to an approved template.",
      ),
      meta: "message_templates.status",
    });
  }

  if (recent.recipients > 0 && recent.coldRatio > COLD_RATIO_WARN) {
    const critical = recent.coldRatio > COLD_RATIO_CRITICAL;
    issues.push({
      key: "cold",
      severity: critical ? "high" : "medium",
      title: `${pct(recent.coldRatio)} ${t("of your recipients never messaged you first")}`,
      detail: t(
        "Cold outreach is the single biggest cause of blocks, and blocks are what move the quality rating.",
      ),
      fix: `${t("Keep cold recipients under")} ${pct(COLD_RATIO_WARN)} ${t("of a day's audience, and warm them with a Utility template first.")}`,
      meta: `${lastDays} · cold_recipient_ratio`,
    });
  }

  if (recent.outgoing > 0 && recent.failedRate > FAILURE_RATE_WARN) {
    const topCode = Object.entries(recent.errors).sort(
      (a, b) => b[1] - a[1],
    )[0];
    issues.push({
      key: "failures",
      severity: "medium",
      title: `${t("Failures climbing —")} ${pct(recent.failedRate)} ${t("of sends")}`,
      detail: topCode
        ? `${t("Most common error:")} ${topCode[0]} (${topCode[1]} ${t("occurrences")})`
        : t("Failed sends are above the healthy range."),
      fix: t(
        "Cut marketing volume by about a third for a week and spread sends across the day.",
      ),
      meta: `${lastDays} · error_codes`,
    });
  }

  if (recent.outgoing > 0 && recent.readRate < READ_RATE_WARN) {
    issues.push({
      key: "read",
      severity: "medium",
      title: `${t("Only")} ${pct(recent.readRate)} ${t("of your messages get read")}`,
      detail: t(
        "A low read rate tells Meta the audience did not want the message, and it feeds the quality rating.",
      ),
      fix: t(
        "Tighten your targeting and lead with why the message matters to that specific person.",
      ),
      meta: `${lastDays} · read_rate`,
    });
  }

  if (recent.pinnedDays >= PINNED_DAYS_WARN) {
    issues.push({
      key: "ceiling",
      severity: "low",
      title: `${t("You hit the daily cap on")} ${recent.pinnedDays} ${t("of the last")} ${recentDayCount} ${t("days")}`,
      detail: t(
        "Messages above the cap roll over to the next day, so campaigns finish late.",
      ),
      fix: t(
        "Meta lifts the cap automatically once quality is Green and volume is steady. Fix quality first.",
      ),
      meta: state?.messagingLimitTier
        ? `messaging_limit_tier = ${state.messagingLimitTier}`
        : "volume_pinned_to_ceiling",
    });
  }

  const order: Record<Severity, number> = { high: 0, medium: 1, low: 2 };
  return issues.sort((a, b) => order[a.severity] - order[b.severity]);
}

/** Tone for a Meta enum value, for chips and dots. */
export function toneFor(
  value: string | null | undefined,
): "success" | "warning" | "destructive" | "neutral" {
  const v = String(value ?? "").toUpperCase();
  if (["GREEN", "AVAILABLE", "APPROVED", "VERIFIED", "ACCEPTED"].includes(v))
    return "success";
  if (
    [
      "YELLOW",
      "LIMITED",
      "PENDING",
      "IN_APPEAL",
      "LIMIT_EXCEEDED",
      "PENDING_REVIEW",
    ].includes(v)
  )
    return "warning";
  if (
    [
      "RED",
      "BLOCKED",
      "REJECTED",
      "PAUSED",
      "DISABLED",
      "RESTRICTED",
      "DECLINED",
    ].includes(v)
  )
    return "destructive";
  return "neutral";
}

/**
 * Messaging tiers, rendered for humans.
 *
 * Not `humanizeEnum`: it lower-cases the whole value, which turns Meta's
 * `TIER_1K` into "Tier 1k". The magnitude suffix is part of the number and has
 * to stay upper-case.
 */
export function formatTier(tier: string | null | undefined): string {
  if (!tier) return "—";
  const bare = tier.replace(/^TIER_/i, "");
  return /^\d+[KM]?$/i.test(bare) ? bare.toUpperCase() : humanizeEnum(bare);
}

/** Meta's SCREAMING_SNAKE enums, rendered for humans. */
export function humanizeEnum(value: string | null | undefined): string {
  if (!value) return "—";
  return value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/^./, (c) => c.toUpperCase());
}

export type { MetricsAggregate };
