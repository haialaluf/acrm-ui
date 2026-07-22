import type {
  CalendarWorkingHours,
  Weekday,
  WorkingHoursDay,
} from "@/supabase/types/ui_types";

// Week ordered Sunday-first (Israel/US business week). `label` is a Spanish
// source string passed through `t()` at render time, like the rest of the app.
export const WEEKDAYS: { key: Weekday; label: string }[] = [
  { key: "sun", label: "Domingo" },
  { key: "mon", label: "Lunes" },
  { key: "tue", label: "Martes" },
  { key: "wed", label: "Miércoles" },
  { key: "thu", label: "Jueves" },
  { key: "fri", label: "Viernes" },
  { key: "sat", label: "Sábado" },
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
    if (hours[d.key]) set.add(DAY_INDEX[d.key]);
  }
  return set;
}

// Earliest "from" and latest "to" across all active days, as Date times on an
// arbitrary day — react-big-calendar only reads the hour/minute for its
// `min`/`max` time-grid bounds. Falls back to 09:00–17:00 when empty.
export function workingHoursBounds(hours: CalendarWorkingHours): {
  min: Date;
  max: Date;
} {
  const active = WEEKDAYS.map((d) => hours[d.key]).filter(
    (h): h is WorkingHoursDay => !!h,
  );
  let min = "09:00";
  let max = "17:00";
  if (active.length) {
    min = active.reduce((m, h) => (h.from < m ? h.from : m), active[0].from);
    max = active.reduce((m, h) => (h.to > m ? h.to : m), active[0].to);
  }
  return { min: timeToDate(min), max: timeToDate(max) };
}

function timeToDate(hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m ?? 0, 0, 0);
  return d;
}

// Sun–Thu 09:00–17:00, Fri/Sat closed — a sensible default business week.
export function defaultWorkingHours(): CalendarWorkingHours {
  const hours: CalendarWorkingHours = {};
  for (const day of WORKDAYS) hours[day] = { from: "09:00", to: "17:00" };
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

export function regionLabel(code: string, locale = "es"): string {
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
  const activeIdx = WEEKDAYS.map((d, i) => (hours[d.key] ? i : -1)).filter(
    (i) => i >= 0,
  );
  if (activeIdx.length === 0) return t("Sin días");
  const initial = (i: number) => t(WEEKDAYS[i].label);
  const contiguous = activeIdx.every(
    (v, i) => i === 0 || v === activeIdx[i - 1] + 1,
  );
  if (contiguous && activeIdx.length > 1) {
    return `${initial(activeIdx[0])} – ${initial(activeIdx[activeIdx.length - 1])}`;
  }
  return activeIdx.map(initial).join(", ");
}

// Single "HH:MM–HH:MM" when every active day shares the same interval, else a
// "variable hours" label.
export function hoursSummary(
  hours: CalendarWorkingHours,
  t: (s: string) => string,
): string {
  const active = WEEKDAYS.map((d) => hours[d.key]).filter(
    (h): h is WorkingHoursDay => !!h,
  );
  if (active.length === 0) return "";
  const [first] = active;
  const uniform = active.every(
    (h) => h.from === first.from && h.to === first.to,
  );
  return uniform ? `${first.from} – ${first.to}` : t("Horario variable");
}
