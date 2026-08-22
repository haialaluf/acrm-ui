import type {
  ContactWithAddressesRow,
  EmailTemplateVariable,
  EmailVariableField,
} from "@/supabase/client";
import { contactEmail } from "@/utils/ContactAddressUtils";

/* Send-time substitution, run here only to preview it.
 *
 * The real substitution happens on the server when the email goes out; this
 * mirrors it so someone can see, before sending, exactly which slots resolve
 * from a contact's record and which fall back. Keeping the two in step matters
 * more than sharing code — a preview that lies is worse than no preview.
 *
 * TWIN FILE: ../acrm-api/supabase/functions/_shared/email_render.ts. `VAR_RE`,
 * `contactValues`, `escapeHtml` and `complianceFooter` below must stay identical
 * to their counterparts there; that file's `email_render.test.ts` pins the
 * shared behaviour, since `npm run types:sync-check` only covers
 * `src/supabase/types` and will not catch drift here. */

/** Matches a numbered slot `{{n}}`, tolerating inner whitespace. */
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
    email: contactEmail(contact) || "",
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

/**
 * The compliance footer the send path appends to every email.
 *
 * Drawn here so the preview shows what the recipient actually gets. It is not
 * part of the canvas and nothing in the builder can restyle or delete it — the
 * business name, the postal address CAN-SPAM requires and the opt-out link are
 * added at send time, from the organization record.
 *
 * `dir="ltr"` on the cell because this text is English and always will be,
 * while the document around it inherits the template's direction. Appended into
 * a `dir="rtl"` email without it, the bidi algorithm moves the trailing colon
 * and the separator to the wrong end — ":This message is sent to you by".
 *
 * TWIN: `complianceFooter` in
 * ../acrm-api/supabase/functions/_shared/email_render.ts. The markup must stay
 * identical; only the href differs, because the real opt-out link is minted per
 * recipient and does not exist yet at preview time.
 */
export function complianceFooter(ctx: {
  organizationName: string;
  organizationAddress: string;
  /** Dead in the preview. Real sends get the recipient's own token URL. */
  unsubscribeHref?: string;
}): string {
  const href = escapeHtml(ctx.unsubscribeHref || "#");

  // Name and address joined only where both exist. `organizations.address` is
  // NOT NULL but may be an empty string, and `Name &middot; ` with nothing
  // after it reads as a rendering fault rather than a missing field.
  const identity = [ctx.organizationName, ctx.organizationAddress]
    .map((part) => part.trim())
    .filter(Boolean)
    .map(escapeHtml)
    .join(" &middot; ");

  return (
    `<table role="presentation" width="100%" cellpadding="0" ` +
    `cellspacing="0" border="0" style="border-collapse:collapse">` +
    `<tr><td align="center" dir="ltr" style="padding:26px 24px 30px;` +
    `font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.7;` +
    `color:#8b938d">` +
    `<div>This message is sent to you by:</div>` +
    `<div style="color:#5f6a62">${identity}</div>` +
    `<div style="padding-top:8px"><a href="${href}" ` +
    `style="color:#8b938d;text-decoration:underline">Unsubscribe</a></div>` +
    `</td></tr></table>`
  );
}

/** Insert before `</body>` when there is one, else append — exactly how the send
 *  path attaches the footer. TWIN: `appendToBody` in email_render.ts. */
export function appendToBody(html: string, block: string): string {
  const idx = html.toLowerCase().lastIndexOf("</body>");
  return idx === -1
    ? html + block
    : html.slice(0, idx) + block + html.slice(idx);
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
