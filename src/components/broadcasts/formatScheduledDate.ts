import dayjs from "dayjs";

/** A batch as far as scheduling display is concerned: its exact send instant
 *  when known, its day otherwise. */
type Scheduled = { scheduled_at?: string | null; scheduled_date: string };

/**
 * What to render a batch's day from. Prefers `scheduled_at`: `scheduled_date`
 * is the day in the *database's* timezone, so a send at 00:30 local in a
 * positive-offset zone is stamped with the previous UTC day and would read as
 * "Yesterday" on a card that goes out tomorrow.
 */
function dayInput(batch: Scheduled) {
  return batch.scheduled_at ?? batch.scheduled_date;
}

/** Relative day label for a date or instant, forward and backward — unlike
 *  Chat.tsx's formatDate, batches can be future-dated. `null` once the day is
 *  far enough out that only the calendar date is meaningful. */
function relativeDayLabel(d: dayjs.Dayjs, t: (s: string) => string) {
  const diff = d.startOf("day").diff(dayjs().startOf("day"), "day");

  if (diff === 0) return t("Today");
  if (diff === 1) return t("Tomorrow");
  if (diff === -1) return t("Yesterday");
  if (diff >= -6 && diff <= 6) return d.format("dddd");
  return null;
}

/** Day label for a batch — "Today", "Tomorrow", "Thursday", "14 March, 2026".
 *  Kept short for the list cards; see `formatBatchDayLong` for the detail. */
export function formatBatchDay(
  batch: Scheduled,
  t: (s: string) => string,
  locale: string,
) {
  const d = dayjs(dayInput(batch)).locale(locale);
  return relativeDayLabel(d, t) ?? d.format("DD MMMM, YYYY");
}

/** Day label with the calendar date spelled out — "Thursday, 27 August 2026".
 *  A relative label alone doesn't say *which* Thursday, and the detail screen
 *  has the room the cards don't. Days past the relative window already read as
 *  a date, so they are returned unchanged rather than doubled up. */
export function formatBatchDayLong(
  batch: Scheduled,
  t: (s: string) => string,
  locale: string,
) {
  const d = dayjs(dayInput(batch)).locale(locale);
  const relative = relativeDayLabel(d, t);
  return relative
    ? `${relative}, ${d.format("D MMMM YYYY")}`
    : d.format("DD MMMM, YYYY");
}

/**
 * Clock time a batch goes out, in the viewer's own timezone, or "" for a row
 * with no send instant (rows written before scheduled_at existed). 24h to
 * match the wizard's own picker, which is where the time was chosen.
 */
export function formatBatchTime(batch: Scheduled) {
  return batch.scheduled_at ? dayjs(batch.scheduled_at).format("HH:mm") : "";
}

/**
 * Clock time for one event inside a batch — a recipient being sent, delivered,
 * cancelled — prefixed with its date when that date is not the batch's own send
 * day. The rows sit under a header that already names the batch's day, so a
 * bare "14:45" reads as that day; wrong for a batch cancelled days before its
 * slot, or a receipt that lands after it.
 */
export function formatEventTime(at: string, batch: Scheduled, locale: string) {
  const d = dayjs(at).locale(locale);
  return d.isSame(dayjs(dayInput(batch)), "day")
    ? d.format("HH:mm")
    : d.format("D MMM HH:mm");
}

/** Sortable instant for a batch — the exact send time, or its day at midnight
 *  local when that is all there is. */
export function batchSortValue(batch: Scheduled) {
  return dayjs(dayInput(batch)).valueOf();
}

/**
 * Sortable instant for history — when the batch actually resolved (sent, failed
 * or cancelled) rather than when it was meant to go out. A batch scheduled for
 * next week and cancelled today belongs where it was cancelled, not pinned to
 * the top of the list behind a date it never reached. Falls back to the send
 * instant for a row with no resolution timestamp.
 */
export function batchActivityValue(
  batch: Scheduled & { activity_at?: string | null },
) {
  return batch.activity_at
    ? dayjs(batch.activity_at).valueOf()
    : batchSortValue(batch);
}
