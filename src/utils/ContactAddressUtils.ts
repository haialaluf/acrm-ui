import { formatPhoneNumber, ltrIsolate } from "@/utils/FormatUtils";
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
    (a) => a.service === "email" && a.status !== "inactive",
  );
}

/** The contact's phone number — the address of their WhatsApp row. */
export function contactPhone(
  contact: ContactWithAddressesRow,
): string | undefined {
  return contactPhoneRow(contact)?.address;
}

/**
 * Status of the contact's phone address row — `'inactive'` once Meta reports
 * it undeliverable (a superseded BSUID, or delivery error 131026). An
 * explicit "remove me" (WhatsApp `הסר`, or an email unsubscribe click) is a
 * different signal entirely: it sets `contacts.status`, the same field
 * regardless of which channel the request came in on, not this row's status.
 * Use `contact.status` for that; this is address-level reachability only.
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
 * Excludes an inactive (bounced/complained) row so callers that mean "is this
 * contact reachable" don't get a dead address back — use `contactEmailStatus`
 * if you need to know *why* it's excluded.
 */
export function contactEmail(
  contact: ContactWithAddressesRow,
): string | undefined {
  return contactEmailRow(contact)?.address;
}

/**
 * Status of the contact's email address row — `'inactive'` once Amazon SES
 * reports a hard bounce, a complaint, or a soft-bounce pattern against this
 * exact mailbox. An unsubscribe-link click is a different signal: like
 * WhatsApp's `הסר`, it sets `contacts.status`, not this row.
 *
 * Undefined when no row exists at all, which means "never flagged":
 * suppression is recorded, never inferred (the same rule
 * `_shared/email_suppression.ts` follows server-side). Deliberately does NOT
 * go through `contactEmail` above — that excludes an inactive row, and this
 * is exactly the function that needs to see it.
 */
export function contactEmailStatus(
  contact: ContactWithAddressesRow,
): string | undefined {
  return contact.addresses?.find((a) => a.service === "email")?.status;
}

/**
 * The contact's Instagram profile picture, whichever thread you are looking at.
 *
 * Only the Instagram address row carries a picture — Meta returns it with the
 * profile fetch and the webhook keeps it fresh. Reading it off the CONTACT
 * rather than off the conversation's own address is what lets a WhatsApp
 * thread show the same face as the Instagram one, instead of falling back to
 * initials for someone we plainly have a photo of.
 */
export function contactInstagramPicture(
  contact: { addresses?: ContactAddressRow[] | null } | null | undefined,
): string | undefined {
  const extra = contact?.addresses?.find((a) => a.service === "instagram")
    ?.extra as { profile_picture_url?: string } | null | undefined;

  return extra?.profile_picture_url ?? undefined;
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

/**
 * Whether a contact looks like one the inbound webhook minted rather than one
 * a person entered.
 *
 * `linkMissingContacts` creates a contact the moment an unknown address writes
 * in, naming it from whatever the profile fetch returned — an @handle, or
 * nothing at all when Meta gives us no profile. Those are exactly the records
 * that turn out to be someone already in the contact list under a phone
 * number, so they are where the merge action belongs. A contact carrying a
 * real name is left alone: it is far likelier to be a person than a duplicate.
 */
export function looksAutoCreated(
  contact: { name?: string | null } | null | undefined,
): boolean {
  if (!contact) return false;

  const name = (contact.name ?? "").trim();

  // No name, an @handle, or the bare address — none of them say a human named
  // this record.
  return !name || name.startsWith("@") || /^[\d+\s-]+$/.test(name);
}

/**
 * The one address to show under a contact's name in a list.
 *
 * The contact list used to print `addresses[0]` — the oldest row, for the
 * reasons above — so the same contact's subtitle flipped between their phone
 * and their email depending on which channel happened to write in first. This
 * fixes an order instead: phone, then Instagram, then email, matching the
 * channel order the contact detail page already lays its rows out in
 * (`CHANNEL_ORDER` in `contacts/$contactId.tsx`).
 *
 * Each service is rendered the way that service is read: a phone number
 * formatted and LTR-isolated so it survives an RTL line, Instagram as its
 * `@username` because the stored address is an igsid no human recognizes, and
 * email verbatim. Returns undefined when the contact has no address at all —
 * the caller supplies its own translated "No address".
 */
export function contactDisplayAddress(
  contact: ContactWithAddressesRow,
): string | undefined {
  const phone = contactPhone(contact);

  if (phone) return ltrIsolate(formatPhoneNumber(phone));

  const instagram = contact.addresses?.find((a) => a.service === "instagram");

  if (instagram) {
    const extra = instagram.extra as
      | { username?: string }
      | null
      | undefined;

    return extra?.username ? `@${extra.username}` : instagram.address;
  }

  // A bounced email is still the address this contact is known by, so the
  // list shows it even though `contactEmail` hides it from send paths.
  return (
    contactEmail(contact) ??
    contact.addresses?.find((a) => a.service === "email")?.address
  );
}
