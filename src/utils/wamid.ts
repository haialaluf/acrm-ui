//===================================
// Ported from acrm-api/.../_shared/wamid.ts
//
// Logic, not a type: `npm run types:sync-check` does NOT cover this file, so a
// change to the API original has to be brought over by hand. The API side is
// the source of truth and carries the tests (_shared/wamid.test.ts).
//===================================

/**
 * The stable WhatsApp message id carried inside a WAMID.
 *
 * A WAMID is base64 over a small tag/length/value structure that packs *how a
 * message was addressed* together with the message's own id. Meta's BSUID
 * migration makes those two disagree: one outgoing message is announced under
 * two different WAMIDs, because the send API and the `sent` status address the
 * recipient by phone number while `delivered` and `read` address them by their
 * business-scoped user id.
 *
 *   \x1c\x18\x0c 972508538399        \x15\x02\x00\x11\x18\x20 A51BCC…E198 \x00
 *   \x1c\x18\x13 IL.4429118904042507 \x15\x14\x00\x11\x18\x20 A51BCC…E198 \x00
 *
 * The trailing field is the message id and is identical in both forms. The API
 * keys outgoing rows on it, while incoming rows keep the raw WAMID — so the two
 * sides of a reaction correlation routinely hold different forms of one id, and
 * running both through this is what makes them meet.
 *
 * Returns the input unchanged when it is not a WAMID we can parse: an id we do
 * not recognize should still key consistently rather than throw. That also
 * makes it idempotent, and a no-op on ids from other services (an Instagram
 * `mid` is passed straight through).
 */
export function whatsappMessageId(wamid: string): string {
  const PREFIX = "wamid.";
  const FIELD_TAG = 0x18;

  if (!wamid.startsWith(PREFIX)) return wamid;

  let bytes: Uint8Array;

  try {
    const binary = atob(wamid.slice(PREFIX.length));

    bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch {
    return wamid;
  }

  // The id is the last tag/length/value field. Its own bytes are ASCII
  // alphanumerics, so a 0x18 can only ever be a tag, never payload.
  const tag = bytes.lastIndexOf(FIELD_TAG);
  const length = bytes[tag + 1];
  const value = bytes.subarray(tag + 2, tag + 2 + length);

  if (tag < 0 || value.length !== length) return wamid;

  const id = String.fromCharCode(...value);

  return /^[0-9A-Za-z]+$/.test(id) ? id : wamid;
}
