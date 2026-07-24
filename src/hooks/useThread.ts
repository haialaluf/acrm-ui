import useBoundStore from "@/stores/useBoundStore";
import type { AppState } from "@/stores/useBoundStore";
import type { ConversationRow } from "@/supabase/client";

/**
 * Thread → conversation row lookups.
 *
 * A thread groups every `conversations` row of one counterpart (see
 * `threadKey`). Components that used to read `chat.conversations.get(convId)`
 * want the row messages are written to and whose `extra` carries the draft,
 * pin and pause flags — the thread's primary row. `updateConvExtra` /
 * `saveDraft` write those flags to every row of the pair, so reading them off
 * the primary is always consistent.
 */
export function selectThreadConversation(
  state: AppState,
  key: string | null | undefined,
): ConversationRow | undefined {
  const thread = key ? state.chat.threads.get(key) : undefined;

  return thread
    ? state.chat.conversations.get(thread.primaryConvId)
    : undefined;
}

export function useThreadConversation(key: string | null | undefined) {
  return useBoundStore((state) => selectThreadConversation(state, key));
}

/** The open thread's primary conversation row. */
export function useActiveConversation() {
  return useBoundStore((state) =>
    selectThreadConversation(state, state.ui.activeThreadKey),
  );
}
