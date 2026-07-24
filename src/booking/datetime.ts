import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

/**
 * Dates for the booking page.
 *
 * Two rules hold everything together:
 *
 * 1. Every instant is rendered in the CALENDAR's timezone, never the visitor's.
 *    A slot the business sees as 10:00 must read 10:00 to the contact too,
 *    whether they open the link from Madrid or from a plane.
 * 2. Nothing here formats by hand. `Intl` already knows month names, weekday
 *    order, and whether the visitor's locale wants 09:00 or 9:00 AM, in every
 *    language the site ships — hand-rolled tables would only be a worse copy.
 *
 * dayjs (+ utc/timezone, both already dependencies) does the civil-calendar
 * arithmetic: "which day, in Asia/Jerusalem, does this instant fall on".
 */

dayjs.extend(utc);
dayjs.extend(timezone);

/** A civil day in the calendar's timezone: "2026-07-24". */
export type DayKey = string;

export type CalendarDay = {
  key: DayKey;
  /** Noon of that day — the instant to hand to `Intl` for display. */
  date: Date;
  dayOfMonth: number;
  /** 0 = Sunday. */
  weekday: number;
};

/** A month in the calendar's timezone: "2026-07". */
export type MonthKey = string;

const NOON = "12:00";

function noon(day: DayKey, tz: string) {
  // Noon, not midnight: a DST jump can delete 00:00 in some zones, and midday
  // is never ambiguous.
  return dayjs.tz(`${day} ${NOON}`, tz);
}

export function todayKey(tz: string): DayKey {
  return dayjs().tz(tz).format("YYYY-MM-DD");
}

export function currentMonth(tz: string): MonthKey {
  return dayjs().tz(tz).format("YYYY-MM");
}

export function monthOf(day: DayKey): MonthKey {
  return day.slice(0, 7);
}

export function shiftMonth(month: MonthKey, months: number): MonthKey {
  return dayjs(`${month}-01`).add(months, "month").format("YYYY-MM");
}

/** The instant a month's first and last moment occupy, for the slots query. */
export function monthRange(
  month: MonthKey,
  tz: string,
): { from: Date; to: Date } {
  const first = noon(`${month}-01`, tz);
  return {
    from: first.startOf("month").toDate(),
    to: noon(`${month}-${String(first.daysInMonth()).padStart(2, "0")}`, tz)
      .endOf("day")
      .toDate(),
  };
}

export function monthDays(month: MonthKey, tz: string): CalendarDay[] {
  const total = noon(`${month}-01`, tz).daysInMonth();

  return Array.from({ length: total }, (_, i) => {
    // Each day is resolved from its own date string rather than by adding to
    // the first: dayjs pins the offset it resolved at construction, so adding
    // across a DST boundary would drift by an hour.
    const day = noon(`${month}-${String(i + 1).padStart(2, "0")}`, tz);
    return {
      key: day.format("YYYY-MM-DD"),
      date: day.toDate(),
      dayOfMonth: i + 1,
      weekday: day.day(),
    };
  });
}

/** Free start instants bucketed into the civil days the visitor will see. */
export function groupByDay(slots: string[], tz: string): Map<DayKey, string[]> {
  const byDay = new Map<DayKey, string[]>();
  for (const slot of slots) {
    const key = dayjs(slot).tz(tz).format("YYYY-MM-DD");
    const bucket = byDay.get(key);
    if (bucket) bucket.push(slot);
    else byDay.set(key, [slot]);
  }
  return byDay;
}

export function addMinutes(iso: string, minutes: number): Date {
  return new Date(new Date(iso).getTime() + minutes * 60_000);
}

// ── display ───────────────────────────────────────────────────────────────

/** First weekday of the week for a locale — 1 = Monday … 7 = Sunday. */
export function firstWeekday(locale: string): number {
  const info = new Intl.Locale(locale) as Intl.Locale & {
    getWeekInfo?: () => { firstDay: number };
    weekInfo?: { firstDay: number };
  };
  const firstDay = info.getWeekInfo?.().firstDay ?? info.weekInfo?.firstDay;
  // Not every engine exposes weekInfo yet; Hebrew, English and Portuguese are
  // the Sunday-first locales this site ships.
  return firstDay ?? (["he", "en", "pt"].includes(locale) ? 7 : 1);
}

/** Weekday column headers, ordered for the locale's week. `0` = Sunday. */
export function weekdayOrder(locale: string): number[] {
  const start = firstWeekday(locale) % 7; // 7 (Sunday) → 0
  return Array.from({ length: 7 }, (_, i) => (start + i) % 7);
}

const REFERENCE_SUNDAY = "2024-01-07T12:00:00Z";

export function weekdayLabel(weekday: number, locale: string): string {
  const date = new Date(
    new Date(REFERENCE_SUNDAY).getTime() + weekday * 86_400_000,
  );
  return new Intl.DateTimeFormat(locale, {
    // Hebrew's short weekday is "יום א׳" — too wide for a 40px column, and its
    // narrow form ("א") is the one Hebrew calendars actually use. English
    // narrow would be a bare "S" for both Saturday and Sunday, so it keeps
    // "Sun".
    weekday: locale === "he" ? "narrow" : "short",
    timeZone: "UTC",
  }).format(date);
}

export function formatTime(instant: Date | string, tz: string, locale: string) {
  // "09:00" reads right in a 24-hour column; "09:00 AM" does not — a 12-hour
  // locale wants the hour unpadded.
  const hour12 = new Intl.DateTimeFormat(locale, {
    hour: "numeric",
  }).resolvedOptions().hour12;

  return new Intl.DateTimeFormat(locale, {
    hour: hour12 ? "numeric" : "2-digit",
    minute: "2-digit",
    timeZone: tz,
  }).format(new Date(instant));
}

export function formatDateLong(
  instant: Date | string,
  tz: string,
  locale: string,
) {
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: tz,
  }).format(new Date(instant));
}

export function formatDayAndMonth(
  instant: Date | string,
  tz: string,
  locale: string,
) {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    timeZone: tz,
  }).format(new Date(instant));
}

export function formatWeekdayLong(
  instant: Date | string,
  tz: string,
  locale: string,
) {
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    timeZone: tz,
  }).format(new Date(instant));
}

export function formatMonthYear(month: MonthKey, tz: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: tz,
  }).format(noon(`${month}-01`, tz).toDate());
}

/** "Jerusalem · GMT+3" — the zone the times above it are in. */
export function zoneLabel(tz: string, locale: string): string {
  const city = tz.split("/").pop()?.replace(/_/g, " ") ?? tz;
  try {
    const offset = new Intl.DateTimeFormat(locale, {
      timeZone: tz,
      timeZoneName: "shortOffset",
    })
      .formatToParts(new Date())
      .find((part) => part.type === "timeZoneName")?.value;
    return offset ? `${city} · ${offset}` : city;
  } catch {
    return city;
  }
}

/** Whether the visitor is reading times from another zone than the calendar's. */
export function visitorIsElsewhere(tz: string): boolean {
  try {
    const here = new Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (here === tz) return false;
    // Same offset right now is close enough — the times on screen match.
    const stamp = (zone: string) =>
      new Intl.DateTimeFormat("en", {
        timeZone: zone,
        timeStyle: "short",
        hour12: false,
      }).format(new Date());
    return stamp(here) !== stamp(tz);
  } catch {
    return false;
  }
}
