import { parsePhoneNumberWithError } from 'libphonenumber-js';

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

export function isValidPhoneNumber(phoneNumber: string): boolean {
  if (!phoneNumber?.trim()) { return true; }

  try {
    const parsed = parsePhoneNumberWithError(phoneNumber, { extract: true });
    return parsed.isValid();
  } catch {
    return false;
  }
}

/**
 * Normalize phone number to E.164 format without the plus sign.
 * For Argentina (+54), ensures the 9 is included after country code for mobile numbers.
 * Returns original if parsing fails.
 */
export function normalizePhoneNumber(phoneNumber: string): string {
  try {
    const parsed = parsePhoneNumberWithError(phoneNumber, { extract: true });
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
