const cache = new Map<string, Record<string, string>>();

export async function loadTranslations(lang: string): Promise<void> {
  if (lang === "es" || cache.has(lang)) return;

  const res = await fetch(`/locales/${lang}.json`);
  if (res.ok) {
    cache.set(lang, await res.json());
  }
}

/**
 * Seed a locale from an already-loaded dictionary instead of fetching it.
 *
 * The booking site (vite.booking.config.ts) bundles its locales with
 * `import.meta.glob` so the page is self-contained on its own origin, where
 * `/locales/*.json` is not served.
 */
export function cacheTranslations(
  lang: string,
  dict: Record<string, string>,
): void {
  cache.set(lang, dict);
}

export function getTranslation(key: string, lang: string): string {
  if (lang === "es") return key;
  return cache.get(lang)?.[key] || key;
}
