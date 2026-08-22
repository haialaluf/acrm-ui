import type {
  ContactAddressRow,
  ContactWithAddressesRow,
} from "@/supabase/client";

/**
 * Reading a contact's phone number off its `contacts_addresses` rows.
 *
 * `useContacts` embeds `addresses:contacts_addresses(*)` ordered by `created_at`
 * with no service filter, so `addresses[0]` is "the oldest address", NOT "the
 * phone". That happened to be the same thing only while WhatsApp was the only
 * service ever written to that table — it stopped being true the moment email
 * addresses got rows of their own (see `service='email'` in
 * `03-02_contacts_addresses.sql`), because a contact imported by email before
 * they ever messaged has their email row first.
 *
 * Positionally, that turns an email string into a phone number: it would be
 * handed to `formatPhoneNumber`, counted as "this contact is reachable" by the
 * bulk-send recipient filter, and sent to the WhatsApp dispatcher. Hence these
 * two helpers — every read of "the contact's phone" goes through them.
 *
 * `emailTemplate/renderTemplate.ts` already filters by service this way; this is
 * the same rule, hoisted so the rest of the app shares it.
 */

/** The contact's WhatsApp address row, if they have one. */
export function contactPhoneRow(
  contact: ContactWithAddressesRow,
): ContactAddressRow | undefined {
  return contact.addresses?.find((a) => a.service === "whatsapp");
}

/** The contact's email address row, if they have one. */
export function contactEmailRow(
  contact: ContactWithAddressesRow,
): ContactAddressRow | undefined {
  return contact.addresses?.find(
    (a) => a.service === "email" && a.status !== "removed",
  );
}

/** The contact's phone number — the address of their WhatsApp row. */
export function contactPhone(
  contact: ContactWithAddressesRow,
): string | undefined {
  return contactPhoneRow(contact)?.address;
}

/**
 * Status of the contact's phone address, which is what the WhatsApp opt-out
 * (`הסר`) sets to `'removed'`. Deliberately scoped to the phone row: an email
 * unsubscribe marks the *email* row removed and must not disable WhatsApp.
 */
export function contactPhoneStatus(
  contact: ContactWithAddressesRow,
): string | undefined {
  return contactPhoneRow(contact)?.status;
}

/**
 * The contact's email address — the address of their `service='email'` row.
 *
 * `contacts.email` is unused: every write path (manual create/edit, CSV
 * import, Meta Lead Ads, the AI agent, the MCP operator tool) now always
 * upserts an address row instead, so this row is the one source of truth.
 * Excludes a removed/unsubscribed row so callers that mean "is this contact
 * reachable" don't get a dead address back — use `contactEmailStatus` if you
 * need to know *why* it's excluded.
 */
export function contactEmail(
  contact: ContactWithAddressesRow,
): string | undefined {
  return contactEmailRow(contact)?.address;
}

/**
 * Status of the contact's email address row — `'removed'` once they have
 * unsubscribed, hard-bounced or been marked as a complaint.
 *
 * Undefined when no row exists at all, which means "never opted out":
 * suppression is recorded, never inferred (the same rule
 * `_shared/email_suppression.ts` follows server-side). Deliberately does NOT
 * go through `contactEmail` above — that excludes a removed row, and this is
 * exactly the function that needs to see it.
 */
export function contactEmailStatus(
  contact: ContactWithAddressesRow,
): string | undefined {
  return contact.addresses?.find((a) => a.service === "email")?.status;
}

/**
 * The display name a contact address carries, if its service records one.
 *
 * WhatsApp and Instagram rows both stash a profile name in `extra`; email rows
 * do not — `extra.opt_out` is all they hold. Since `ContactAddressExtra` is a
 * union across all three, `extra.name` is not a property of the union type and
 * every "name fallback" chain needs the narrowing done once, here, rather than
 * inline at each call site.
 */
export function contactAddressName(
  row: ContactAddressRow | null | undefined,
): string | undefined {
  const extra = row?.extra;

  if (!extra || typeof extra !== "object") return undefined;

  return "name" in extra && typeof extra.name === "string"
    ? extra.name
    : undefined;
}
