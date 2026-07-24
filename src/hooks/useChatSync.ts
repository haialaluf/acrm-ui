import { supabase } from "@/supabase/client";
import useBoundStore from "@/stores/useBoundStore";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

/**
 * Keeps the chat store honest across a backgrounded tab.
 *
 * The initial burst this hook used to do is gone: the sidebar's first page
 * (`useConversationsPage`) and the open thread's first page
 * (`useThreadMessages`) load exactly what is on screen, and the rest arrives as
 * the user scrolls.
 *
 * What still needs handling is a tab that was hidden long enough for the
 * realtime channel to miss events. On the way back:
 *  - the conversation pages and the open thread's messages are invalidated, so
 *    react-query refetches page 1 of each;
 *  - a flat `updated_at` sweep catches edits to messages that are already
 *    loaded (delivery/read receipts, media that finished processing), which no
 *    page refetch would surface because those rows keep their old timestamp.
 */
export const useChatSync = () => {
  const activeOrgId = useBoundStore((state) => state.ui.activeOrgId);
  const pushMessages = useBoundStore((state) => state.chat.pushMessages);
  const pushConversations = useBoundStore(
    (state) => state.chat.pushConversations,
  );
  const queryClient = useQueryClient();

  const lastVisibleAt = useRef<Date | null>(null);

  useEffect(() => {
    const sweep = async (since: Date) => {
      const orgId = useBoundStore.getState().ui.activeOrgId;
      if (!orgId) return;

      const { data: conversations } = await supabase
        .from("conversations")
        .select()
        .eq("organization_id", orgId)
        .gt("updated_at", since.toISOString())
        .order("updated_at", { ascending: false })
        .limit(999)
        .throwOnError();

      pushConversations(conversations ?? []);

      const { data: messages } = await supabase
        .from("messages")
        .select()
        .eq("organization_id", orgId)
        .gt("updated_at", since.toISOString())
        .order("updated_at", { ascending: false })
        .limit(999)
        .throwOnError();

      // Only messages of conversations we hold: anything else belongs to a
      // thread the user has not paged to, and would otherwise sit forever in
      // the orphan buffer waiting for a conversation row that never arrives.
      const known = useBoundStore.getState().chat.conversations;

      pushMessages(
        (messages ?? []).filter((msg) => known.has(msg.conversation_id)),
      );

      // Only the sidebar list: it decides *which* threads exist, so a thread
      // that became relevant while the tab slept has to be re-fetched. The
      // per-thread message queries are deliberately left alone — invalidating
      // one replays every page the reader scrolled through.
      queryClient.invalidateQueries({
        queryKey: [orgId, "conversations", "page"],
      });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        lastVisibleAt.current = new Date();
      } else if (
        document.visibilityState === "visible" &&
        lastVisibleAt.current
      ) {
        sweep(lastVisibleAt.current);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrgId]);
};
