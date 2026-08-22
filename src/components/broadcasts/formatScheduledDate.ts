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
 *  Chat.tsx's formatDate, batches can be future-dated. */
function formatScheduledDate(
  dateStr: string,
  t: (s: string) => string,
  locale: string,
) {
  const d = dayjs(dateStr).locale(locale);
  const diff = d.startOf("day").diff(dayjs().startOf("day"), "day");

  if (diff === 0) return t("Today");
  if (diff === 1) return t("Tomorrow");
  if (diff === -1) return t("Yesterday");
  if (diff > 1 && diff <= 6) return d.format("dddd");
  if (diff < -1 && diff >= -6) return d.format("dddd");
  return d.format("DD MMMM, YYYY");
}

/** Day label for a batch — "Today", "Tomorrow", "Thursday", "14 March, 2026". */
export function formatBatchDay(
  batch: Scheduled,
  t: (s: string) => string,
  locale: string,
) {
  return formatScheduledDate(dayInput(batch), t, locale);
}

/**
 * Clock time a batch goes out, in the viewer's own timezone, or "" for a row
 * with no send instant (rows written before scheduled_at existed). 24h to
 * match the wizard's own picker, which is where the time was chosen.
 */
export function formatBatchTime(batch: Scheduled) {
  return batch.scheduled_at ? dayjs(batch.scheduled_at).format("HH:mm") : "";
}

/** Sortable instant for a batch — the exact send time, or its day at midnight
 *  local when that is all there is. */
export function batchSortValue(batch: Scheduled) {
  return dayjs(dayInput(batch)).valueOf();
}
