import { cacheTranslations, getTranslation } from "@/i18n/translations";

/**
 * Translation for the booking site — deliberately a tiny local shim, not
 * `hooks/useTranslation`, which pulls in `useBoundStore` (and with it the whole
 * app's state, supabase client and router).
 *
 * The locale JSON is bundled rather than fetched: this page is served from
 * calendar.delacrm.com, which has no `/locales/` to fetch from.
 */

const LANGUAGES = ["es", "en", "pt", "sw", "fr", "he"] as const;
export type Language = (typeof LANGUAGES)[number];

const RTL: Language[] = ["he"];

export function isRtl(lang: Language): boolean {
  return RTL.includes(lang);
}

const dictionaries = import.meta.glob<{ default: Record<string, string> }>(
  "../../public/locales/*.json",
  { eager: true },
);

/** The visitor's browser language, if we have a dictionary for it. Spanish is
 *  the source language, so it needs no dictionary. */
export function detectLanguage(): Language {
  const tag = navigator.language?.slice(0, 2).toLowerCase();
  return (LANGUAGES as readonly string[]).includes(tag)
    ? (tag as Language)
    : "es";
}

export function initI18n(lang: Language): void {
  if (lang === "es") return;
  const entry = dictionaries[`../../public/locales/${lang}.json`];
  if (entry) cacheTranslations(lang, entry.default);
}

/** `t("Spanish source string")` — same convention as the rest of the app. */
export function makeT(lang: Language) {
  return (key: string) => getTranslation(key, lang);
}
