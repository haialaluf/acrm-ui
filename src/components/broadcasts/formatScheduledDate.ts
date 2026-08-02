import dayjs from "dayjs";

/** Relative day label for a batch's scheduled_date (YYYY-MM-DD), forward and
 *  backward — unlike Chat.tsx's formatDate, batches can be future-dated. */
export function formatScheduledDate(
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
