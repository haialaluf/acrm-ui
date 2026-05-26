import parseNumber, { parsePhoneNumberWithError } from 'libphonenumber-js';

/**
 * Country assumed when a number is written in local format (no country code),
 * e.g. "0501234567". Parsing tries international form first and only falls
 * back to this country.
 */
const DEFAULT_COUNTRY = 'IL' as const;

export function removeAccents(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Function that searches a specific criteria inside a string term with
 * case insensitive and without accents for a character matching search.
 * @param searchCriteria is the term we'll be looking to match inside term
 * @param term the string being looked up
 * @returns
 */
export function isIncludedIn(searchCriteria: string, term: string) {
  return searchCriteria.length
    ? removeAccents(term)
      .toLowerCase()
      .includes(removeAccents(searchCriteria).toLowerCase())
    : true;
}

export function nameInitials(name: string): string {
  const names = name.split(" ");

  if (names.length === 1) {
    return names[0].slice(0, 2);
  }

  if (names.length > 1) {
    return names
      .slice(0, 2)
      .map((name) => name[0])
      .join("");
  }

  return "?";
}

export function formatPhoneNumber(phoneNumber: string): string {
  try {
    const parsed = parsePhoneNumberWithError("+" + phoneNumber, { extract: false });
    return parsed.formatInternational();
  } catch (error) {
    return phoneNumber;
  }
}

/**
 * Wrap text in Unicode left-to-right isolates (U+2066 … U+2069) so it renders
 * LTR even inside an RTL layout — e.g. phone numbers, whose "+" and digit
 * groups otherwise get reordered. Safe in text nodes and title attributes, and
 * keeps the value a plain string (unlike a dir="ltr" element).
 */
export function ltrIsolate(text: string): string {
  return `\u2066${text}\u2069`;
}

// Allows digits (0–9), plus (+), spaces, dashes (-), parentheses () and dots (.);
// rejects anything else (notably letters) so we fail fast before parsing.
const hasInvalidCharacters = (phoneNumber: string): boolean => {
  const validPattern = /^[\d+\s\-().]+$/;
  return !validPattern.test(phoneNumber);
};

// Strip formatting characters, keeping only digits and a single leading plus.
// "+1 (847) 529-8119" → "+18475298119"; "050-123-4567" → "0501234567".
const stripFormatting = (phoneNumber: string): string => {
  const cleaned = phoneNumber.replace(/[^\d+]/g, '');
  const hasLeadingPlus = cleaned.startsWith('+');
  const digits = cleaned.replace(/\+/g, '');
  return hasLeadingPlus ? `+${digits}` : digits;
};

/**
 * Parse a raw phone string into a libphonenumber-js `PhoneNumber`.
 *
 * Tries to parse it as an international number first; if that is missing or
 * invalid (e.g. a local "0501234567"), retries assuming `DEFAULT_COUNTRY`.
 * Throws `Error("Invalid phone number")` when neither yields a valid number.
 */
export function parsePhoneNumber(phoneNumber: string) {
  if (hasInvalidCharacters(phoneNumber)) {
    throw new Error('Invalid phone number');
  }

  const normalized = stripFormatting(phoneNumber);
  if (!normalized) {
    throw new Error('Invalid phone number');
  }

  const international = parseNumber(normalized);
  if (international?.isValid()) return international;

  const local = parseNumber(normalized, DEFAULT_COUNTRY);
  if (local?.isValid()) return local;

  throw new Error('Invalid phone number');
}

export function isValidPhoneNumber(phoneNumber: string): boolean {
  try {
    parsePhoneNumber(phoneNumber);
    return true;
  } catch {
    return false;
  }
}

/**
 * Normalize a phone number to E.164 format without the plus sign — the form
 * stored in the DB and consumed across the app (dedup matching, display).
 * For Argentina (+54), ensures the mobile "9" follows the country code.
 * Returns a digits-only fallback if parsing fails.
 */
export function normalizePhoneNumber(phoneNumber: string): string {
  try {
    const parsed = parsePhoneNumber(phoneNumber);
    // remove the +
    let number = parsed.number.slice(1);

    if (parsed.country === "AR" && !number.startsWith("549")) {
      number = number.replace("54", "549");
    }

    return number
  } catch {
    // Return cleaned version (digits only) if parsing fails
    return phoneNumber.replace(/\D/g, '');
  }
}
