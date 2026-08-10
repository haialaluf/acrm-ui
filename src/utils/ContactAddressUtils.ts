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
 * The contact's email address.
 *
 * Read off `contacts.email`, NOT off the `service='email'` address row — the
 * mirror image of the phone rule above, and for a reason worth stating. The
 * address rows for email exist only where something has created them: the
 * `20260808165833` backfill did it for contacts that already existed, and
 * `mint_unsubscribe_links` does it at send time, but nothing maintains one when
 * a contact is created or edited. So a contact added yesterday has an email and
 * no email row, and filtering recipients on the row would quietly exclude them.
 *
 * Lower-cased and trimmed to match `public.normalize_email` — the address row,
 * the suppression check and the unsubscribe token are all keyed on that form,
 * so a recipient list built from the raw column would look up the wrong row.
 */
export function contactEmail(
  contact: ContactWithAddressesRow,
): string | undefined {
  const email = contact.email?.trim().toLowerCase();

  // A '@' at position 0 has no local part. Same shape check the
  // unsubscribe_links CHECK constraint applies, so the wizard cannot offer a
  // recipient the send path would then refuse.
  return email && email.indexOf("@") > 0 ? email : undefined;
}

/**
 * Status of the contact's email address row — `'removed'` once they have
 * unsubscribed, hard-bounced or been marked as a complaint.
 *
 * Undefined when no row exists, which means "never opted out": suppression is
 * recorded, never inferred (the same rule `_shared/email_suppression.ts`
 * follows server-side). Matched on the normalized address for the reason given
 * in `contactEmail`.
 */
export function contactEmailStatus(
  contact: ContactWithAddressesRow,
): string | undefined {
  const email = contactEmail(contact);
  if (!email) return undefined;

  return contact.addresses?.find(
    (a) => a.service === "email" && a.address === email,
  )?.status;
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
