import type {
  ContactWithAddressesRow,
  EmailTemplateVariable,
  EmailVariableField,
} from "@/supabase/client";

/* Send-time substitution, run here only to preview it.
 *
 * The real substitution happens on the server when the email goes out; this
 * mirrors it so someone can see, before sending, exactly which slots resolve
 * from a contact's record and which fall back. Keeping the two in step matters
 * more than sharing code — a preview that lies is worse than no preview. */

/** Matches a numbered slot `{{n}}`, tolerating inner whitespace. System tokens
 *  (`{{unsubscribe_url}}`, `{{sender_identity}}`, `{{view_in_browser}}`) are
 *  deliberately excluded: they are filled at send time, not from a contact. */
const VAR_RE = /\{\{\s*(\d+)\s*\}\}/g;

export type Resolution = {
  n: number;
  /** True when the contact actually had a value, false when the fallback ran. */
  fromContact: boolean;
  value: string;
};

/**
 * What a contact record offers each variable field.
 *
 * `contacts` stores a person as `name` + `surname` with no separate full name,
 * and the phone lives on a related `contacts_addresses` row rather than the
 * contact itself — hence the reach into `addresses` for it.
 */
export function contactValues(
  contact?: ContactWithAddressesRow,
): Partial<Record<EmailVariableField, string>> {
  if (!contact) return {};

  const first = contact.name?.trim() || "";
  const last = contact.surname?.trim() || "";
  const phone = contact.addresses?.find(
    (a) => a.service === "whatsapp",
  )?.address;

  return {
    first_name: first,
    last_name: last,
    full_name: [first, last].filter(Boolean).join(" "),
    email: contact.email || "",
    phone: phone || "",
  };
}

/** Resolve one slot: the contact's value if there is one, else the fallback. */
function resolve(
  variable: EmailTemplateVariable | undefined,
  values: Partial<Record<EmailVariableField, string>>,
): Resolution | null {
  if (!variable) return null;

  // `custom` has no contact field by definition — it is always the fallback.
  const fromContact =
    variable.field === "custom" ? "" : values[variable.field] || "";

  return {
    n: variable.n,
    fromContact: !!fromContact,
    value: fromContact || variable.fallback,
  };
}

/**
 * Substitute every `{{n}}` in `text`.
 *
 * A slot with no matching variable is left as literal `{{n}}` rather than
 * blanked: a visible `{{3}}` in the preview is how someone notices they deleted
 * a variable that is still placed in the design.
 */
export function renderText(
  text: string,
  variables: EmailTemplateVariable[],
  values: Partial<Record<EmailVariableField, string>>,
): string {
  return text.replace(VAR_RE, (match, n: string) => {
    const hit = resolve(
      variables.find((v) => v.n === Number(n)),
      values,
    );
    return hit ? hit.value : match;
  });
}

/**
 * The same substitution over the compiled email, wrapping each filled slot in a
 * tinted `<span>` so the preview can show at a glance which values came from
 * the contact (green) and which are fallbacks (amber).
 *
 * The values are HTML-escaped on the way in: a contact whose company is
 * `Smith & Sons <Ltd>` must not be able to break the markup of a preview, and
 * the same escaping is what the send path has to do for real.
 */
export function renderHtml(
  html: string,
  variables: EmailTemplateVariable[],
  values: Partial<Record<EmailVariableField, string>>,
): { html: string; resolutions: Resolution[] } {
  const resolutions: Resolution[] = [];

  const out = html.replace(VAR_RE, (match, n: string) => {
    const hit = resolve(
      variables.find((v) => v.n === Number(n)),
      values,
    );

    if (!hit) return match;

    resolutions.push(hit);

    const tint = hit.fromContact
      ? "background:rgba(101,182,124,.28)"
      : "background:rgba(219,161,66,.32)";

    return `<span style="${tint};border-radius:3px;padding:0 3px">${escapeHtml(
      hit.value,
    )}</span>`;
  });

  return { html: out, resolutions };
}

/** Which slots are placed in the design but have no variable defined, and which
 *  variables are defined but never placed — both are silent bugs at send time,
 *  so the Variables panel surfaces them. */
export function auditVariables(
  html: string,
  variables: EmailTemplateVariable[],
): { unplaced: number[]; undefinedSlots: number[] } {
  const placed = new Set<number>();
  for (const match of html.matchAll(VAR_RE)) placed.add(Number(match[1]));

  const defined = new Set(variables.map((v) => v.n));

  return {
    unplaced: [...defined].filter((n) => !placed.has(n)).sort((a, b) => a - b),
    undefinedSlots: [...placed]
      .filter((n) => !defined.has(n))
      .sort((a, b) => a - b),
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
