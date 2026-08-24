import type {
  CalendarWorkingHours,
  Weekday,
  WorkingHoursDay,
} from "@/supabase/types/extra_types";

// Week ordered Sunday-first (Israel/US business week). `label` is an English
// source string passed through `t()` at render time, like the rest of the app.
export const WEEKDAYS: { key: Weekday; label: string }[] = [
  { key: "sun", label: "Sunday" },
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" },
];

const WORKDAYS: Weekday[] = ["sun", "mon", "tue", "wed", "thu"];

// Weekday key → JS Date.getDay() index (Sunday = 0), for react-big-calendar,
// which works in getDay() space.
export const DAY_INDEX: Record<Weekday, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

// getDay() indices the calendar accepts bookings on — used to grey out closed
// days on the board.
export function workingDayIndexSet(hours: CalendarWorkingHours): Set<number> {
  const set = new Set<number>();
  for (const d of WEEKDAYS) {
    if (hours[d.key]?.length) set.add(DAY_INDEX[d.key]);
  }
  return set;
}

// Earliest "from" and latest "to" across every window of every active day, as
// Date times on an arbitrary day — react-big-calendar only reads the
// hour/minute for its `min`/`max` time-grid bounds. Falls back to 09:00–17:00
// when empty.
export function workingHoursBounds(hours: CalendarWorkingHours): {
  min: Date;
  max: Date;
} {
  const windows = WEEKDAYS.flatMap((d) => hours[d.key] ?? []);
  let min = "09:00";
  let max = "17:00";
  if (windows.length) {
    min = windows.reduce((m, w) => (w.from < m ? w.from : m), windows[0].from);
    max = windows.reduce((m, w) => (w.to > m ? w.to : m), windows[0].to);
  }
  return { min: timeToDate(min), max: timeToDate(max) };
}

function timeToDate(hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m ?? 0, 0, 0);
  return d;
}

// "HH:MM" ↔ minutes past local midnight, for window math (validation,
// sorting, and the "add window" suggestion).
export function toMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

export function toHHMM(v: number): string {
  return `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(
    v % 60,
  ).padStart(2, "0")}`;
}

// Windows on a day, earliest first.
export function sortWindows(windows: WorkingHoursDay[]): WorkingHoursDay[] {
  return [...windows].sort((a, b) => toMin(a.from) - toMin(b.from));
}

// Structural equality of two (already-sorted) window lists.
export function sameWindows(
  a: WorkingHoursDay[],
  b: WorkingHoursDay[],
): boolean {
  return (
    a.length === b.length &&
    a.every((w, i) => w.from === b[i].from && w.to === b[i].to)
  );
}

export type WindowIssue = "order" | "overlap" | null;

// Per-window problems within one day: "order" when a window's end isn't
// after its start, "overlap" when it overlaps another window on the same
// day.
export function windowIssues(windows: WorkingHoursDay[]): WindowIssue[] {
  const issues: WindowIssue[] = windows.map(() => null);
  windows.forEach((w, i) => {
    if (toMin(w.to) <= toMin(w.from)) issues[i] = "order";
  });
  const sorted = windows
    .map((w, i) => ({ i, s: toMin(w.from), e: toMin(w.to) }))
    .sort((a, b) => a.s - b.s);
  for (let k = 1; k < sorted.length; k++) {
    if (sorted[k].s < sorted[k - 1].e) {
      if (!issues[sorted[k].i]) issues[sorted[k].i] = "overlap";
      if (!issues[sorted[k - 1].i]) issues[sorted[k - 1].i] = "overlap";
    }
  }
  return issues;
}

// Whether any active day in `hours` has a window problem — gates saving.
export function hasWorkingHoursIssues(hours: CalendarWorkingHours): boolean {
  return WEEKDAYS.some((d) => {
    const windows = hours[d.key];
    return !!windows && windowIssues(windows).some(Boolean);
  });
}

// Suggest the next window when a day already has some: an hour after the
// latest end, two hours long, clamped so it stays within the day.
export function nextWindowSuggestion(
  windows: WorkingHoursDay[],
): WorkingHoursDay {
  const last = windows.reduce((mx, w) => Math.max(mx, toMin(w.to)), 0);
  const from = Math.min(last + 60, 22 * 60);
  const to = Math.min(from + 120, 23 * 60 + 59);
  return { from: toHHMM(from), to: toHHMM(to) };
}

// Write out every weekday, closed ones as an explicit `[]`.
//
// Only needed where the value lands in a deep-merged jsonb column — today
// `organizations.extra.business_profile.working_hours`. The `merge_update`
// trigger recurses into objects and only ever SETS leaves, so a key the new
// value omits keeps whatever it held before: switching Friday off by deleting
// its key would silently leave Friday's old hours in the database, and the
// agent would go on telling clients the business is open. An empty array is a
// value, so it overwrites — and every reader already reads `[]` and "absent"
// the same way ("closed").
//
// Calendars don't need this: `calendars.working_hours` is its own column,
// replaced wholesale on update.
export function expandClosedDays(
  hours: CalendarWorkingHours,
): CalendarWorkingHours {
  const next: CalendarWorkingHours = {};
  for (const d of WEEKDAYS) next[d.key] = hours[d.key] ?? [];
  return next;
}

// Sun–Thu 09:00–17:00, Fri/Sat closed — a sensible default business week.
export function defaultWorkingHours(): CalendarWorkingHours {
  const hours: CalendarWorkingHours = {};
  for (const day of WORKDAYS) hours[day] = [{ from: "09:00", to: "17:00" }];
  return hours;
}

// Curated ISO 3166 country codes for the country picker; labels are localized
// to the active UI language via Intl.DisplayNames.
export const COUNTRY_CODES = [
  "IL",
  "US",
  "GB",
  "FR",
  "DE",
  "ES",
  "IT",
  "NL",
  "PT",
  "BE",
  "CH",
  "AT",
  "SE",
  "NO",
  "DK",
  "FI",
  "IE",
  "PL",
  "GR",
  "RU",
  "UA",
  "TR",
  "AE",
  "SA",
  "EG",
  "IN",
  "CN",
  "JP",
  "KR",
  "AU",
  "NZ",
  "CA",
  "MX",
  "BR",
  "AR",
  "ZA",
];

// Primary IANA timezone per country — what we persist to `calendars.timezone`
// when the user picks a country other than the auto-detected one.
const REGION_TZ: Record<string, string> = {
  IL: "Asia/Jerusalem",
  US: "America/New_York",
  GB: "Europe/London",
  FR: "Europe/Paris",
  DE: "Europe/Berlin",
  ES: "Europe/Madrid",
  IT: "Europe/Rome",
  NL: "Europe/Amsterdam",
  PT: "Europe/Lisbon",
  BE: "Europe/Brussels",
  CH: "Europe/Zurich",
  AT: "Europe/Vienna",
  SE: "Europe/Stockholm",
  NO: "Europe/Oslo",
  DK: "Europe/Copenhagen",
  FI: "Europe/Helsinki",
  IE: "Europe/Dublin",
  PL: "Europe/Warsaw",
  GR: "Europe/Athens",
  RU: "Europe/Moscow",
  UA: "Europe/Kyiv",
  TR: "Europe/Istanbul",
  AE: "Asia/Dubai",
  SA: "Asia/Riyadh",
  EG: "Africa/Cairo",
  IN: "Asia/Kolkata",
  CN: "Asia/Shanghai",
  JP: "Asia/Tokyo",
  KR: "Asia/Seoul",
  AU: "Australia/Sydney",
  NZ: "Pacific/Auckland",
  CA: "America/Toronto",
  MX: "America/Mexico_City",
  BR: "America/Sao_Paulo",
  AR: "America/Argentina/Buenos_Aires",
  ZA: "Africa/Johannesburg",
};

// Fallback timezone → region for locales that carry no region subtag.
const TZ_REGION: Record<string, string> = {
  "Asia/Jerusalem": "IL",
  "Asia/Tel_Aviv": "IL",
  "America/New_York": "US",
  "America/Los_Angeles": "US",
  "America/Chicago": "US",
  "Europe/London": "GB",
  "Europe/Paris": "FR",
  "Europe/Berlin": "DE",
  "Europe/Madrid": "ES",
  "Europe/Rome": "IT",
  "Europe/Amsterdam": "NL",
  "Asia/Dubai": "AE",
  "Asia/Kolkata": "IN",
  "Australia/Sydney": "AU",
  "America/Sao_Paulo": "BR",
};

export function regionLabel(code: string, locale = "en"): string {
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code) || code;
  } catch {
    return code;
  }
}

export function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Jerusalem";
  } catch {
    return "Asia/Jerusalem";
  }
}

export function detectRegion(): string {
  try {
    const loc = new Intl.Locale(navigator.language || "he-IL");
    if (loc.region) return loc.region;
  } catch {
    /* noop */
  }
  const tz = detectTimezone();
  return TZ_REGION[tz] ?? "IL";
}

// Persist the browser's exact IANA timezone when the chosen country matches the
// auto-detected one (most accurate); otherwise fall back to the country's
// primary zone. Keeps `calendars.timezone` a valid IANA id for the scheduler.
export function resolveTimezone(
  region: string,
  detected: { region: string; timezone: string },
): string {
  if (region === detected.region && detected.timezone) {
    return detected.timezone;
  }
  return REGION_TZ[region] ?? detected.timezone ?? "Asia/Jerusalem";
}

// Compact "Dom–Jue" style run of active weekday initials, else a comma list.
export function daysSummary(
  hours: CalendarWorkingHours,
  t: (s: string) => string,
): string {
  const activeIdx = WEEKDAYS.map((d, i) =>
    hours[d.key]?.length ? i : -1,
  ).filter((i) => i >= 0);
  if (activeIdx.length === 0) return t("No days");
  const initial = (i: number) => t(WEEKDAYS[i].label);
  const contiguous = activeIdx.every(
    (v, i) => i === 0 || v === activeIdx[i - 1] + 1,
  );
  if (contiguous && activeIdx.length > 1) {
    return `${initial(activeIdx[0])} – ${initial(activeIdx[activeIdx.length - 1])}`;
  }
  return activeIdx.map(initial).join(", ");
}

// Windows joined "HH:MM–HH:MM, HH:MM–HH:MM" (up to 2, "+N" beyond that) when
// every active day shares the same window list, else a "variable hours"
// label.
export function hoursSummary(
  hours: CalendarWorkingHours,
  t: (s: string) => string,
): string {
  const active = WEEKDAYS.map((d) => hours[d.key]).filter(
    (h): h is WorkingHoursDay[] => !!h && h.length > 0,
  );
  if (active.length === 0) return "";
  const first = sortWindows(active[0]);
  const uniform = active.every((h) => sameWindows(sortWindows(h), first));
  if (!uniform) return t("Variable hours");
  const shown = first
    .slice(0, 2)
    .map((w) => `${w.from} – ${w.to}`)
    .join(", ");
  return first.length > 2 ? `${shown} +${first.length - 2}` : shown;
}
