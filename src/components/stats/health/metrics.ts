import type { DailyMetricRow } from "@/queries/useWhatsAppHealth";

/**
 * One day of sending behaviour, normalized.
 *
 * The generated RPC return type overstates nullability: every ratio is
 * `round(x / nullif(y, 0))` so it is null on a zero-volume day, and
 * `messaging_limit` / `volume_pinned_to_ceiling` are null until the health
 * poller has run at least once. Everything is coalesced here so no chart or
 * aggregate has to think about it again.
 */
export type DayMetrics = {
  day: string; // YYYY-MM-DD, UTC
  outgoing_count: number;
  incoming_count: number;
  inbound_outbound_ratio: number;
  recipient_count: number;
  cold_recipient_count: number;
  cold_recipient_ratio: number;
  delivered_count: number;
  delivered_rate: number;
  read_count: number;
  read_rate: number;
  failed_count: number;
  /**
   * Outgoing messages a receipt could ever arrive for — the ones the CRM sent.
   * Meta reports no delivery or read status for messages sent from the WhatsApp
   * Business app, so `delivered_rate` and `read_rate` divide by this rather
   * than by `outgoing_count`. The difference between the two is the day's
   * app-sent volume.
   */
  receipt_eligible_count: number;
  error_codes: Record<string, number>;
  messaging_limit: number | null;
  volume_pinned_to_ceiling: boolean;
};

export type MetricsAggregate = {
  outgoing: number;
  incoming: number;
  recipients: number;
  cold: number;
  delivered: number;
  read: number;
  failed: number;
  /**
   * Outgoing messages that could earn a receipt, i.e. everything except what
   * was sent from the WhatsApp Business app. `deliveredRate` and `readRate`
   * divide by this, so gate on it — not on `outgoing` — before reading either,
   * or a window sent entirely from the phone reports 0% rather than "unknown".
   */
  receiptEligible: number;
  coldRatio: number;
  deliveredRate: number;
  readRate: number;
  failedRate: number;
  ioRatio: number;
  /** Days whose recipient count reached the cap exactly. */
  pinnedDays: number;
  /** Meta error code → occurrences, summed over the window. */
  errors: Record<string, number>;
  /** Cap in force, from the most recent day that reported one. */
  limit: number | null;
};

const num = (v: unknown): number => (typeof v === "number" ? v : 0);

function toErrorMap(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, number> = {};
  for (const [code, count] of Object.entries(value)) {
    if (typeof count === "number") out[code] = count;
  }
  return out;
}

function normalize(row: DailyMetricRow): DayMetrics {
  return {
    day: row.day,
    outgoing_count: num(row.outgoing_count),
    incoming_count: num(row.incoming_count),
    inbound_outbound_ratio: num(row.inbound_outbound_ratio),
    recipient_count: num(row.recipient_count),
    cold_recipient_count: num(row.cold_recipient_count),
    cold_recipient_ratio: num(row.cold_recipient_ratio),
    delivered_count: num(row.delivered_count),
    delivered_rate: num(row.delivered_rate),
    read_count: num(row.read_count),
    read_rate: num(row.read_rate),
    failed_count: num(row.failed_count),
    receipt_eligible_count: num(row.receipt_eligible_count),
    error_codes: toErrorMap(row.error_codes),
    messaging_limit:
      typeof row.messaging_limit === "number" ? row.messaging_limit : null,
    volume_pinned_to_ceiling: row.volume_pinned_to_ceiling === true,
  };
}

function emptyDay(day: string, limit: number | null): DayMetrics {
  return {
    day,
    outgoing_count: 0,
    incoming_count: 0,
    inbound_outbound_ratio: 0,
    recipient_count: 0,
    cold_recipient_count: 0,
    cold_recipient_ratio: 0,
    delivered_count: 0,
    delivered_rate: 0,
    read_count: 0,
    read_rate: 0,
    failed_count: 0,
    receipt_eligible_count: 0,
    error_codes: {},
    messaging_limit: limit,
    volume_pinned_to_ceiling: false,
  };
}

/** UTC day key, matching the RPC's `(timestamp at time zone 'UTC')::date`. */
export function utcDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
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

/** Only the rows belonging to one phone number. */
export function filterByAddress(
  rows: DailyMetricRow[],
  address: string | null | undefined,
): DailyMetricRow[] {
  if (!address) return [];
  return rows.filter((r) => r.organization_address === address);
}

/**
 * A contiguous, ascending series of exactly `count` days ending at `end`.
 *
 * The RPC emits no row at all for a day with no WhatsApp messages, so charting
 * its output directly would silently compress gaps — a quiet week would look
 * like a busy one. Missing days become explicit zeros, carrying the last known
 * cap so the ceiling line stays continuous.
 */
export function fillDays(
  rows: DailyMetricRow[],
  count: number,
  end: Date = new Date(),
): DayMetrics[] {
  const byDay = new Map<string, DayMetrics>();
  for (const row of rows) byDay.set(row.day, normalize(row));

  // The cap is a property of the number, not the day: the RPC stamps every row
  // with the newest snapshot's limit, so any row that has one has the same one.
  const limit =
    [...byDay.values()].find((d) => d.messaging_limit != null)
      ?.messaging_limit ?? null;

  return dayKeysEndingAt(end, count).map(
    (day) => byDay.get(day) ?? emptyDay(day, limit),
  );
}

/**
 * The displayed window and the equal-length window before it, for deltas.
 * Expects `rows` to cover at least `2 * count` days (see `useWhatsAppDailyMetrics`).
 */
export function splitWindows(
  rows: DailyMetricRow[],
  count: number,
  end: Date = new Date(),
): { current: DayMetrics[]; previous: DayMetrics[] } {
  const previousEnd = new Date(end);
  previousEnd.setUTCDate(previousEnd.getUTCDate() - count);
  return {
    current: fillDays(rows, count, end),
    previous: fillDays(rows, count, previousEnd),
  };
}

const ratio = (n: number, d: number) => (d > 0 ? n / d : 0);

export function aggregate(days: DayMetrics[]): MetricsAggregate {
  const sum = (pick: (d: DayMetrics) => number) =>
    days.reduce((total, d) => total + pick(d), 0);

  const outgoing = sum((d) => d.outgoing_count);
  const recipients = sum((d) => d.recipient_count);
  const cold = sum((d) => d.cold_recipient_count);
  const delivered = sum((d) => d.delivered_count);
  const read = sum((d) => d.read_count);
  const failed = sum((d) => d.failed_count);
  const receiptEligible = sum((d) => d.receipt_eligible_count);
  const incoming = sum((d) => d.incoming_count);

  const errors: Record<string, number> = {};
  for (const day of days) {
    for (const [code, count] of Object.entries(day.error_codes)) {
      errors[code] = (errors[code] ?? 0) + count;
    }
  }

  return {
    outgoing,
    incoming,
    recipients,
    cold,
    delivered,
    read,
    failed,
    receiptEligible,
    coldRatio: ratio(cold, recipients),
    // Not `outgoing`: messages sent from the WhatsApp Business app never get a
    // receipt from Meta, so counting them here charged the account for a
    // delivery failure that never happened and pushed both rates down by
    // whatever share of the traffic came from the phone.
    deliveredRate: ratio(delivered, receiptEligible),
    readRate: ratio(read, receiptEligible),
    // Failures are reported for everything we dispatched, and an app-sent
    // message cannot fail from our side, so this one stays on `outgoing`.
    failedRate: ratio(failed, outgoing),
    ioRatio: ratio(incoming, outgoing),
    pinnedDays: days.filter((d) => d.volume_pinned_to_ceiling).length,
    errors,
    limit:
      [...days].reverse().find((d) => d.messaging_limit != null)
        ?.messaging_limit ?? null,
  };
}

/** Short axis/tooltip label for a UTC day key, e.g. "2/8". */
export function dayLabel(day: string): string {
  const [, month, date] = day.split("-");
  return `${Number(date)}/${Number(month)}`;
}
