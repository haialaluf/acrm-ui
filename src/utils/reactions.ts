import {
  type ConversationRow,
  type MessageRow,
  type OutgoingMessage,
} from "@/supabase/client";
import {
  newMessage,
  pushMessageToDb,
  pushMessageToStore,
} from "./MessageUtils";
import { whatsappMessageId } from "./wamid";

/** The emoji offered in the quick bar, in WhatsApp's own order. */
export const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

/**
 * One live reaction on a message.
 *
 * `side` is the reacting party as the *channel* sees it: the organization
 * shares a single WhatsApp number, so every agent reacts as one participant and
 * a second agent's reaction replaces the first upstream. `agentId` and
 * `contactAddress` name the reactor behind that side — whichever one applies —
 * and are used to label the chip.
 */
export type Reaction = {
  emoji: string;
  side: "contact" | "org";
  agentId: string | null;
  /** Set on the contact side; group threads have one per participant. */
  contactAddress: string | null;
  at: string;
};

export function isReactionRow(m: MessageRow): boolean {
  return m.content.type === "text" && m.content.kind === "reaction";
}

/**
 * The party a reaction row is attributed to. Group threads carry several
 * contacts on the incoming side, so those key by address; everything the
 * organization sends collapses onto one key.
 */
function reactorKey(m: MessageRow): string {
  return m.direction === "incoming" ? `contact:${m.contact_address}` : "org";
}

/**
 * The key a reaction and its target agree on.
 *
 * Both hold a channel id, but not always in the same shape: an incoming
 * reaction's `re_message_id` is the raw WAMID Meta sent, while the outgoing
 * message it points at is stored under the bare id (see utils/wamid.ts). Left
 * unnormalized, a contact reacting to a message we sent correlates with
 * nothing. `whatsappMessageId` is idempotent and passes through ids it cannot
 * parse, so running *both* sides through it is safe on every id form —
 * Instagram `mid`s included.
 */
export function reactionKey(id: string): string {
  return whatsappMessageId(id);
}

/**
 * The id the channel's reaction endpoint expects for a target message.
 *
 * Not the same thing as `reactionKey`: correlating our own rows can use either
 * form as long as both sides agree, but Meta only accepts the full WAMID.
 */
export function reactionTargetId(target: MessageRow): string | undefined {
  // Incoming rows keep the raw channel id, which is already what it wants.
  if (target.direction !== "outgoing") return target.external_id ?? undefined;

  // Outgoing rows are keyed on the bare id, which Meta rejects; the raw WAMID
  // is kept on the status instead. Absent on anything sent before the API
  // started keeping it, and unbackfillable — the caller has to handle that.
  return target.status.wamid;
}

/**
 * Current reactions of a thread, keyed by `reactionKey` of the message they
 * point at — `re_message_id` holds the channel's id (a WhatsApp WAMID or an
 * Instagram `mid`), never our uuid.
 *
 * `messages` must be newest-first, the order `chatSlice` maintains: the first
 * row seen for a (target, reactor) pair is the live one and every older row for
 * that pair is superseded. A row with empty text is a *removal* — it still
 * claims the pair, so the older reaction stays buried, but adds no chip.
 */
export function indexReactions(
  messages: MessageRow[],
): Map<string, Reaction[]> {
  const superseded = new Set<string>();
  const byTarget = new Map<string, Reaction[]>();

  for (const m of messages) {
    if (!isReactionRow(m)) continue;

    const targetId = m.content.re_message_id
      ? reactionKey(m.content.re_message_id)
      : undefined;
    if (!targetId) continue;

    const pair = `${targetId}|${reactorKey(m)}`;
    if (superseded.has(pair)) continue;
    superseded.add(pair);

    const emoji = m.content.type === "text" ? m.content.text : "";
    if (!emoji) continue; // an "unreact"

    const reactions = byTarget.get(targetId) ?? [];
    reactions.push({
      emoji,
      side: m.direction === "incoming" ? "contact" : "org",
      agentId: m.agent_id,
      contactAddress: m.direction === "incoming" ? m.contact_address : null,
      at: m.timestamp,
    });
    byTarget.set(targetId, reactions);
  }

  // Oldest first, so a chip does not jump sideways when the other party reacts.
  for (const reactions of byTarget.values()) {
    reactions.sort((a, b) => +new Date(a.at) - +new Date(b.at));
  }

  return byTarget;
}

/**
 * Adds, replaces or removes the organization's reaction on `target`.
 *
 * Picking the emoji that is already there removes it, the way tapping your own
 * reaction does in WhatsApp. Removal is an ordinary reaction message with an
 * empty emoji — the convention both dispatchers already implement — so nothing
 * here needs to update or delete a row (`messages` allows neither).
 */
export async function toggleReaction({
  conv,
  target,
  emoji,
  agentId,
  current,
}: {
  conv: ConversationRow;
  target: MessageRow;
  emoji: string;
  agentId?: string;
  /** The organization's chip on this message, if it has one. */
  current?: Reaction;
}) {
  // The endpoint's id, not our storage key: sending the bare id is exactly the
  // bug that made reactions to our own messages render here and never arrive.
  const re_message_id = reactionTargetId(target);
  if (!re_message_id) return;

  const content: OutgoingMessage = {
    version: "1",
    type: "text",
    kind: "reaction",
    text: current?.emoji === emoji ? "" : emoji,
    re_message_id,
  };

  const record = newMessage(conv, "outgoing", content, agentId);

  pushMessageToStore(record); // the chip lands before the round trip
  await pushMessageToDb(record); // insert trigger → dispatcher
}
