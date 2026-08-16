import { type MessageRow } from "@/supabase/client";
import { whatsappMessageId } from "./wamid";

/**
 * Resolving `content.re_message_id` — the pointer a reaction, a reply or a
 * forward carries.
 *
 * It always holds the *channel's* id (a WhatsApp WAMID, an Instagram `mid`),
 * never our uuid, and the two sides of a correlation routinely hold different
 * forms of that id. Everything here exists to make them meet.
 */

/**
 * The key a pointer and its target agree on.
 *
 * Both hold a channel id, but not always in the same shape: an incoming
 * pointer's `re_message_id` is the raw WAMID Meta sent, while the outgoing
 * message it points at is stored under the bare id (see utils/wamid.ts). Left
 * unnormalized, a contact reacting or replying to a message we sent correlates
 * with nothing. `whatsappMessageId` is idempotent and passes through ids it
 * cannot parse, so running *both* sides through it is safe on every id form —
 * Instagram `mid`s included.
 */
export function channelKey(id: string): string {
  return whatsappMessageId(id);
}

/**
 * The id the channel expects when addressing a target message — Meta's
 * `context.message_id` for a reply, the reaction endpoint's `message_id`.
 *
 * Not the same thing as `channelKey`: correlating our own rows can use either
 * form as long as both sides agree, but the endpoint accepts exactly one.
 *
 * Returns `undefined` when the id was never kept, which is final and
 * unbackfillable — callers must disable the affordance rather than send a
 * pointer the channel will reject.
 */
export function channelMessageId(target: MessageRow): string | undefined {
  // Incoming rows keep the raw channel id, which is already what it wants.
  if (target.direction !== "outgoing") return target.external_id ?? undefined;

  switch (target.service) {
    // Instagram never transforms the id: the mid the send response returned is
    // exactly what the endpoint addresses, and `external_id` keeps it verbatim.
    case "instagram":
      return target.external_id ?? undefined;

    // The internal test service has no channel at all, so nothing ever fills
    // `external_id`. Its own uuid is the only stable handle, and it correlates
    // because both sides of a local thread live in this database.
    case "local":
      return target.id;

    // WhatsApp: outgoing rows are keyed on the bare id, which Meta rejects; the
    // raw WAMID is kept on the status instead (see status_types.ts). Absent on
    // anything sent before the API started keeping it.
    default:
      return target.status.wamid;
  }
}

/**
 * Every message in a thread, reachable by any channel id it might be addressed
 * by — which is how a `re_message_id` finds the row it points at.
 *
 * A row is registered under each id form it carries, because the pointer's
 * shape depends on who wrote it: a contact quoting a message we sent names it
 * by the full WAMID, while our own row is keyed on the bare id.
 */
export function indexByChannelId(
  messages: MessageRow[],
): Map<string, MessageRow> {
  const byId = new Map<string, MessageRow>();

  for (const message of messages) {
    if (message.external_id) {
      byId.set(channelKey(message.external_id), message);
    }

    if (message.direction === "outgoing" && message.status.wamid) {
      byId.set(channelKey(message.status.wamid), message);
    }

    // The local service's pointer is the uuid itself (see channelMessageId).
    if (message.service === "local") {
      byId.set(message.id, message);
    }
  }

  return byId;
}
