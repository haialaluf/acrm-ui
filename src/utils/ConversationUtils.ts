import useBoundStore from "@/stores/useBoundStore";
import {
  type ConversationInsert,
  type ConversationRow,
  supabase,
} from "@/supabase/client";

/** Separator between the organization address and the counterpart address in a
 *  thread key. Neither a WhatsApp address (digits) nor an Instagram username
 *  can contain it, and it survives a URL hash untouched. */
const THREAD_SEPARATOR = "~";

/**
 * The UI's unit of conversation.
 *
 * The DB may hold several `conversations` rows for the same counterpart — a row
 * can be closed and a new one opened, and `before_insert_on_messages` always
 * attaches new messages to the newest `active` row — but the sidebar shows one
 * entry per counterpart. Rows therefore collapse onto
 * `organization_address ~ contact_address`, matching what `updateConvExtra` and
 * `saveDraft` below already do (they update *every* row for the pair).
 *
 * Conversations with neither a contact nor a group address (the `local`
 * agent-chat ones) fall back to their row id so they never merge with each
 * other. Kept in sync with `public.conversations_page`, which builds the same
 * key server-side.
 */
export function threadKey(conv: ConversationRow | ConversationInsert): string {
  const counterpart = conv.contact_address ?? conv.group_address ?? conv.id;

  return `${conv.organization_address}${THREAD_SEPARATOR}${counterpart}`;
}

/** Splits a thread key back into its two halves. The counterpart may itself be
 *  a conversation id (see `threadKey`), which callers detect by shape. */
export function parseThreadKey(key: string) {
  const index = key.indexOf(THREAD_SEPARATOR);

  if (index === -1) {
    return { organizationAddress: key, counterpart: "" };
  }

  return {
    organizationAddress: key.slice(0, index),
    counterpart: key.slice(index + THREAD_SEPARATOR.length),
  };
}

/**
 * The conversation row new messages must be written to: the newest `active`
 * row, mirroring the lookup in `before_insert_on_messages`. Falls back to the
 * newest row of any status so a thread whose rows are all closed can still be
 * rendered (and its history read).
 */
export function primaryConversation(convs: ConversationRow[]) {
  const byNewest = [...convs].sort(
    (a, b) => +new Date(b.created_at || 0) - +new Date(a.created_at || 0),
  );

  return byNewest.find((c) => c.status === "active") ?? byNewest[0];
}

function pushConversationToStore(record: ConversationInsert) {
  // TODO: optimistic insert lacks some fields that the store considers as present - cabra 2024/07/28
  useBoundStore.getState().chat.pushConversations([record as ConversationRow]);
}

export async function pushConversationToDb(record: ConversationInsert) {
  const insertQuery = await supabase.from("conversations").insert(record);

  if (insertQuery.error) {
    throw insertQuery.error;
  }
}

/** Optimistically creates a conversation. Returns the record so callers can
 *  use both its id (to send on) and its thread key (to navigate to). */
export function startConversation(conv: ConversationInsert) {
  const record: ConversationInsert = {
    ...conv,
    id: crypto.randomUUID(),
  };

  pushConversationToStore(record);

  return record;
}

/** Conversation ids of the thread a row belongs to, from the store. */
function threadConvIds(conversation: ConversationRow) {
  const key = threadKey(conversation);

  return (
    useBoundStore.getState().chat.threads.get(key)?.convIds ?? [conversation.id]
  );
}

/**
 * Pin / archive / pause applies to the whole thread, so it is written to every
 * conversation row of that counterpart. Targeting the rows by id (rather than
 * by organization_address + contact_address, as this used to) also covers the
 * `local` agent chats, whose contact_address is null and which therefore never
 * matched the old equality filter.
 */
export const updateConvExtra = async (
  conversation: ConversationRow,
  extra: {
    pinned?: string | null;
    archived?: string | null;
    paused?: string | null;
  },
) => {
  const { error } = await supabase
    .from("conversations")
    .update({ extra })
    .in("id", threadConvIds(conversation));

  if (error) {
    throw error;
  }
};

export async function saveDraft(
  conv: ConversationRow,
  text: string | null,
  sendAsContact?: boolean,
) {
  let origin = "human";

  if (sendAsContact !== undefined) {
    origin = sendAsContact ? "human-as-contact" : "human-as-organization";
  }

  const payload = {
    extra: {
      draft: text
        ? {
            text,
            timestamp: new Date().toISOString(),
            origin,
          }
        : null,
    },
  };

  const { error } = await supabase
    .from("conversations")
    .update(payload)
    .in("id", threadConvIds(conv));

  if (error) {
    throw error;
  }
}
