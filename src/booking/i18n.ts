import { cacheTranslations, getTranslation } from "@/i18n/translations";

/**
 * Translation for the booking site — deliberately a tiny local shim, not
 * `hooks/useTranslation`, which pulls in `useBoundStore` (and with it the whole
 * app's state, supabase client and router).
 *
 * The public page ships two languages, Hebrew and English. Unlike the CRM it
 * never falls back to the Spanish source strings: a contact opening a link has
 * no account and no language setting, so both languages resolve through a
 * dictionary and the visitor can flip between them from the page itself.
 *
 * The locale JSON is bundled rather than fetched: this page is served from
 * calendar.delacrm.com, which has no `/locales/` to fetch from.
 */

const LANGUAGES = ["he", "en"] as const;
export type Language = (typeof LANGUAGES)[number];

export const LANGUAGE_OPTIONS: { value: Language; label: string }[] = [
  { value: "he", label: "עברית" },
  { value: "en", label: "EN" },
];

const STORAGE_KEY = "booking:lang";

export function isRtl(lang: Language): boolean {
  return lang === "he";
}

const dictionaries = import.meta.glob<{ default: Record<string, string> }>(
  "../../public/locales/{he,en}.json",
  { eager: true },
);

// `Asia/Tel_Aviv` is a legacy alias some systems still report.
const ISRAEL_ZONES = ["Asia/Jerusalem", "Asia/Tel_Aviv"];

/**
 * Whether the visitor is in Israel, judged by the clock their browser is set
 * to. No geolocation call (that would put a permission prompt in front of a
 * booking link) and no IP lookup (that would be a third-party request from a
 * page whose URL is a credential).
 */
export function visitorIsInIsrael(): boolean {
  try {
    return ISRAEL_ZONES.includes(
      new Intl.DateTimeFormat().resolvedOptions().timeZone,
    );
  } catch {
    return false;
  }
}

/**
 * Whether to offer the language switch at all.
 *
 * Only visitors in Israel plausibly want either language. Everyone else gets
 * English and no control — a toggle offering Hebrew to someone who can't read
 * it is a way to get stranded, not a feature.
 */
export function canChooseLanguage(): boolean {
  return visitorIsInIsrael();
}

/** The visitor's own choice if they made one, else where and who they are. */
export function detectLanguage(): Language {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
  } catch {
    // Blocked storage (private mode): fall through to detection.
  }
  if ((LANGUAGES as readonly string[]).includes(stored ?? "")) {
    return stored as Language;
  }
  // A Hebrew browser abroad still reads Hebrew, so language comes first and
  // location decides the rest.
  const readsHebrew = navigator.language?.toLowerCase().startsWith("he");
  return readsHebrew || visitorIsInIsrael() ? "he" : "en";
}

export function rememberLanguage(lang: Language): void {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // Not remembering the choice is not worth failing the page over.
  }
}

/** Both dictionaries up front — switching language must not await a fetch. */
export function initI18n(): void {
  for (const lang of LANGUAGES) {
    const entry = dictionaries[`../../public/locales/${lang}.json`];
    if (entry) cacheTranslations(lang, entry.default);
  }
}

/** `t("Spanish source string")` — same convention as the rest of the app. */
export function makeT(lang: Language) {
  return (key: string) => getTranslation(key, lang);
}

export type Translate = ReturnType<typeof makeT>;
