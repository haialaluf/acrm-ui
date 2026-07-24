/**
 * Whether `contact_first_name` is safe to greet someone by.
 *
 * The CRM stores whatever the channel gave it: a real first name, but just as
 * often a phone number ("+34 600 11 22 33"), an email, an id, or a WhatsApp
 * push name full of emoji. "Hola +34600112233" reads worse than no greeting at
 * all, so the name is rendered only when it actually looks like a name —
 * letters (any script), with the punctuation real names carry.
 */
const NAME = /^\p{L}[\p{L}\p{M}'’.\- ]*$/u;

const MAX_LENGTH = 40;

export function displayName(raw: string | null | undefined): string | null {
  const name = raw?.trim().replace(/\s+/g, " ") ?? "";
  if (!name || name.length > MAX_LENGTH) return null;
  return NAME.test(name) ? name : null;
}

/** Up to two initials for the avatar, from the letters of the first two words. */
export function initials(text: string): string {
  return (text.match(/\p{L}[\p{L}\p{M}]*/gu) ?? [])
    .slice(0, 2)
    .map((word) => [...word][0]?.toUpperCase() ?? "")
    .join("");
}
