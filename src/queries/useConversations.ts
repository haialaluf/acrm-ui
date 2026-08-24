import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type ConversationRow, supabase } from "@/supabase/client";
import useBoundStore from "@/stores/useBoundStore";
import { threadConvIds, threadKey } from "@/utils/ConversationUtils";
import { queryKeys } from "./queryKeys";

/**
 * Permanently deletes a thread: every `conversations` row of the counterpart
 * (closed ones included, like `updateConvExtra`), whose whole message history
 * goes with them through the `messages` foreign key cascade. Irreversible, and
 * reserved to admins/owners by a restrictive RLS policy — a member's delete
 * removes no rows.
 */
export function useDeleteConversation() {
  const queryClient = useQueryClient();
  const orgId = useBoundStore((state) => state.ui.activeOrgId);
  const removeThread = useBoundStore((state) => state.chat.removeThread);

  return useMutation({
    mutationFn: async (conversation: ConversationRow) => {
      if (!orgId) throw new Error("No active organization");

      const ids = threadConvIds(conversation);

      const { count } = await supabase
        .from("conversations")
        .delete({ count: "exact" })
        .in("id", ids)
        .throwOnError();

      // RLS rejects a forbidden delete by matching no rows rather than by
      // erroring, so a silent 0 has to be turned into a failure — otherwise the
      // dialog would close on a chat that is still there.
      if (!count) {
        throw new Error("Conversation was not deleted");
      }

      return threadKey(conversation);
    },
    onSuccess: (key) => {
      // The sidebar renders from the store, so dropping the thread there is
      // what makes the row disappear at once.
      removeThread(key);

      // Both the deep-link lookup and the thread's message pages hang off this
      // prefix. Removed, not invalidated: the same counterpart writing again
      // rebuilds a thread under this very key, and a stale cache would hand it
      // the history that was just deleted.
      queryClient.removeQueries({
        queryKey: queryKeys.conversations.thread(orgId, key),
      });

      void queryClient.invalidateQueries({
        queryKey: [orgId, "conversations", "page"],
      });
    },
  });
}
