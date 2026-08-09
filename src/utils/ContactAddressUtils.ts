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
