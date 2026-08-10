import type { EmailDailyMetricRow } from "@/queries/useEmailHealth";
import { utcDayKey } from "../metrics";

/**
 * One day of email deliverability, normalized.
 *
 * The generated RPC return type overstates nullability: both rates are
 * `round(x / nullif(sent, 0))` and so come back null on a day with no sends.
 * Coalescing here means no chart or aggregate has to think about it again.
 */
export type EmailDayMetrics = {
  day: string; // YYYY-MM-DD, UTC
  sent_count: number;
  delivered_count: number;
  opened_count: number;
  bounced_count: number;
  soft_bounced_count: number;
  complained_count: number;
  suppressed_count: number;
  failed_count: number;
  bounce_rate: number;
  complaint_rate: number;
};

export type EmailAggregate = {
  sent: number;
  delivered: number;
  opened: number;
  bounced: number;
  softBounced: number;
  complained: number;
  suppressed: number;
  failed: number;
  deliveredRate: number;
  openRate: number;
  /**
   * Recomputed over the window rather than averaged from the daily rates: a
   * mean of per-day rates weights a 3-send day the same as a 3,000-send day,
   * which is exactly how a bounce problem gets hidden. SES computes its own
   * rates over volume, so these have to as well to mean the same thing.
   */
  bounceRate: number;
  complaintRate: number;
};

const num = (v: unknown): number => (typeof v === "number" ? v : 0);

function normalize(row: EmailDailyMetricRow): EmailDayMetrics {
  return {
    day: row.day,
    sent_count: num(row.sent_count),
    delivered_count: num(row.delivered_count),
    opened_count: num(row.opened_count),
    bounced_count: num(row.bounced_count),
    soft_bounced_count: num(row.soft_bounced_count),
    complained_count: num(row.complained_count),
    suppressed_count: num(row.suppressed_count),
    failed_count: num(row.failed_count),
    bounce_rate: num(row.bounce_rate),
    complaint_rate: num(row.complaint_rate),
  };
}

function emptyDay(day: string): EmailDayMetrics {
  return {
    day,
    sent_count: 0,
    delivered_count: 0,
    opened_count: 0,
    bounced_count: 0,
    soft_bounced_count: 0,
    complained_count: 0,
    suppressed_count: 0,
    failed_count: 0,
    bounce_rate: 0,
    complaint_rate: 0,
  };
}

/** `count` consecutive UTC day keys ending at `end`, oldest first. */
function dayKeysEndingAt(end: Date, count: number): string[] {
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setUTCDate(d.getUTCDate() - i);
    keys.push(utcDayKey(d));
  }
  return keys;
}

/** Only the rows belonging to one sending domain. */
export function filterByAddress(
  rows: EmailDailyMetricRow[],
  address: string | null | undefined,
): EmailDailyMetricRow[] {
  if (!address) return [];
  return rows.filter((r) => r.organization_address === address);
}

/**
 * A contiguous, ascending series of exactly `count` days ending at `end`.
 *
 * The RPC emits no row for a day with no email, so charting its output directly
 * would compress the gaps and make a quiet fortnight look like a busy one.
 */
export function fillEmailDays(
  rows: EmailDailyMetricRow[],
  count: number,
  end: Date = new Date(),
): EmailDayMetrics[] {
  const byDay = new Map<string, EmailDayMetrics>();
  for (const row of rows) byDay.set(row.day, normalize(row));

  return dayKeysEndingAt(end, count).map(
    (day) => byDay.get(day) ?? emptyDay(day),
  );
}

/** The displayed window and the equal-length window before it, for deltas. */
export function splitEmailWindows(
  rows: EmailDailyMetricRow[],
  count: number,
  end: Date = new Date(),
): { current: EmailDayMetrics[]; previous: EmailDayMetrics[] } {
  const previousEnd = new Date(end);
  previousEnd.setUTCDate(previousEnd.getUTCDate() - count);

  return {
    current: fillEmailDays(rows, count, end),
    previous: fillEmailDays(rows, count, previousEnd),
  };
}

const ratio = (n: number, d: number) => (d > 0 ? n / d : 0);

export function aggregateEmail(days: EmailDayMetrics[]): EmailAggregate {
  const sum = (pick: (d: EmailDayMetrics) => number) =>
    days.reduce((total, d) => total + pick(d), 0);

  const sent = sum((d) => d.sent_count);
  const delivered = sum((d) => d.delivered_count);
  const opened = sum((d) => d.opened_count);
  const bounced = sum((d) => d.bounced_count);
  const complained = sum((d) => d.complained_count);

  return {
    sent,
    delivered,
    opened,
    bounced,
    softBounced: sum((d) => d.soft_bounced_count),
    complained,
    suppressed: sum((d) => d.suppressed_count),
    failed: sum((d) => d.failed_count),
    deliveredRate: ratio(delivered, sent),
    openRate: ratio(opened, sent),
    bounceRate: ratio(bounced, sent),
    complaintRate: ratio(complained, sent),
  };
}
