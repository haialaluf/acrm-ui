/**
 * Client-side email validation.
 *
 * TWIN FILE: acrm-api/supabase/functions/_shared/email_validation.ts holds the
 * authoritative version. The same deliberate arrangement as
 * `email_render.ts` ↔ `emailTemplate/renderTemplate.ts`: two tested twins rather
 * than one shared module, because the server half also does DNS-over-HTTPS
 * lookups and imports the Deno runtime, neither of which belongs in a form.
 *
 * The SYNTAX regex, MAX_LENGTH, DISPOSABLE and TYPOS below MUST stay identical
 * to the server's, or the form accepts something the lead pipeline rejects (or
 * worse, the reverse — the form rejects an address the server would have been
 * happy to mail). Nothing enforces this automatically; keep them in step by
 * hand, as `check-type-sync.sh` only diffs `types/`.
 *
 * What is NOT mirrored here is the MX lookup. A form cannot usefully wait on
 * DNS per keystroke, and the domain check runs anyway at the two points that
 * matter — lead ingestion and send time. So this catches typos and rubbish; the
 * server catches domains that cannot receive mail.
 */

/** Identical to the server's SYNTAX. Stricter than HTML5 `type="email"`: it
 *  requires a dot in the domain, so `john@localhost` is rejected. */
const SYNTAX =
  /^[^\s@,;:<>()[\]\\"]+@[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;

const MAX_LENGTH = 254;

const DISPOSABLE = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "10minutemail.com",
  "tempmail.com",
  "temp-mail.org",
  "throwawaymail.com",
  "yopmail.com",
  "trashmail.com",
  "sharklasers.com",
  "getnada.com",
  "maildrop.cc",
  "fakeinbox.com",
]);

/**
 * Common typos of high-volume mail domains.
 *
 * A suggestion, never an auto-correction — see the server twin for why this
 * list is load-bearing (`gmial.com` is a live typosquatter with working MX
 * records, so no automated check can reject it; only the person who typed it
 * can).
 */
const TYPOS: Record<string, string> = {
  "gmial.com": "gmail.com",
  "gmai.com": "gmail.com",
  "gmail.co": "gmail.com",
  "gmail.con": "gmail.com",
  "gmail.cm": "gmail.com",
  "gnail.com": "gmail.com",
  "gmaill.com": "gmail.com",
  "hotmial.com": "hotmail.com",
  "hotmai.com": "hotmail.com",
  "hotmail.con": "hotmail.com",
  "hotmial.co.il": "hotmail.co.il",
  "outlok.com": "outlook.com",
  "outlook.con": "outlook.com",
  "yaho.com": "yahoo.com",
  "yahoo.con": "yahoo.com",
  "walla.co.i": "walla.co.il",
  "walla.con": "walla.co.il",
};

export type EmailCheck = {
  ok: boolean;
  /** Normalized (lowercased, trimmed) when `ok`. */
  email: string | null;
  reason: "empty" | "too_long" | "syntax" | "disposable" | null;
  /** A likely intended domain when the given one looks like a typo. */
  suggestion: string | null;
};

/** The part after the last `@`, lowercased. */
export function emailDomain(email: string): string {
  const at = email.lastIndexOf("@");

  return at < 0 ? "" : email.slice(at + 1).toLowerCase();
}

/** Twin of `validateEmailSyntax` on the server. */
export function checkEmail(raw: string | null | undefined): EmailCheck {
  const email = (raw ?? "").trim().toLowerCase();

  if (!email) {
    return { ok: false, email: null, reason: "empty", suggestion: null };
  }

  if (email.length > MAX_LENGTH) {
    return { ok: false, email: null, reason: "too_long", suggestion: null };
  }

  const domain = emailDomain(email);
  const suggestion = TYPOS[domain] ?? null;

  if (!SYNTAX.test(email)) {
    return { ok: false, email: null, reason: "syntax", suggestion };
  }

  if (DISPOSABLE.has(domain)) {
    return { ok: false, email: null, reason: "disposable", suggestion: null };
  }

  return { ok: true, email, reason: null, suggestion };
}

/**
 * react-hook-form `validate` for an optional email field.
 *
 * Returns `true` when acceptable, or an **untranslated** message — the same
 * contract the phone field beside it uses (`|| "Invalid number"`), because
 * `FieldError` runs the result through `t` itself and translating here would
 * translate twice.
 *
 * An empty value passes: the field is optional, and "required" is a separate
 * concern from "valid". A typo'd domain also passes — it is only ever a hint,
 * so it must never block a save when the person really does mean that address.
 */
export function validateEmailField(
  value: string | null | undefined,
): true | string {
  if (!value?.trim()) return true;

  const check = checkEmail(value);

  if (check.ok) return true;

  if (check.reason === "disposable") {
    return "That is a temporary or disposable email address";
  }

  return "Invalid email address";
}

/**
 * A "did you mean …?" hint, or null.
 *
 * Separate from `validateEmailField` on purpose: a suggestion is advice, not an
 * error, so it must not participate in form validity. Showing it as a validation
 * failure would stop someone saving an address they know is right.
 */
export function emailSuggestion(
  value: string | null | undefined,
): string | null {
  if (!value?.trim()) return null;

  return checkEmail(value).suggestion;
}
