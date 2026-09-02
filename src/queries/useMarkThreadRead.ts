import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/supabase/client";
import useBoundStore from "@/stores/useBoundStore";

/**
 * Tell the contact their message was seen — because it was: someone opened the
 * thread here.
 *
 * The RPC stamps `status.read` on the thread's newest inbound message, which is
 * what `handle_mark_as_read_to_dispatcher` turns into WhatsApp blue ticks or an
 * Instagram "Seen". It is idempotent and picks the row itself, so callers can
 * fire it whenever a thread is on screen without tracking what is already
 * acknowledged.
 *
 * No `invalidateQueries`: nothing rendered here reads inbound `status.read`, and
 * the updated row arrives over realtime anyway.
 */
export function useMarkThreadRead() {
  const orgId = useBoundStore((state) => state.ui.activeOrgId);

  return useMutation({
    mutationFn: async (conversationIds: string[]) => {
      if (!orgId) throw new Error("No active organization");
      if (!conversationIds.length) return 0;

      const { data } = await supabase
        .rpc("mark_thread_read", {
          p_organization_id: orgId,
          p_conversation_ids: conversationIds,
        })
        .throwOnError();

      return data;
    },
  });
}
