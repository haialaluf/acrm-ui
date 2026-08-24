import {
  type ConversationRow,
  type MessageRow,
  supabase,
} from "@/supabase/client";
import useBoundStore from "@/stores/useBoundStore";
import { useEffect } from "react";

export const useRealtimeSubscription = () => {
  const activeOrgId = useBoundStore((state) => state.ui.activeOrgId);

  const pushConversations = useBoundStore(
    (state) => state.chat.pushConversations,
  );
  const pushMessages = useBoundStore((state) => state.chat.pushMessages);
  const notifyRealtimeMessage = useBoundStore(
    (state) => state.chat.notifyRealtimeMessage,
  );

  useEffect(() => {
    if (!activeOrgId) return;

    const filter = `organization_id=eq.${activeOrgId}`;

    const channel = supabase
      .channel("rialtaim")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversations",
          filter,
        },
        (payload) => {
          // TODO: https://github.com/supabase/supabase/issues/32817
          if (payload.table !== "conversations") return;

          const conversation = payload.new as ConversationRow;

          // A DELETE carries an empty `new`; pushing it would create a junk
          // thread keyed on undefined. (Deletes rarely reach here at all — the
          // `organization_id` filter cannot match a payload that, under the
          // default replica identity, holds only the primary key.)
          if (!conversation?.id) return;

          pushConversations([conversation]);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter,
        },
        async (payload) => {
          // TODO: https://github.com/supabase/supabase/issues/32817
          if (payload.table !== "messages") return;

          const message = payload.new as MessageRow;

          // A brand-new counterpart's first message can beat its conversation
          // row here (`pushMessages` parks it), and can also belong to a thread
          // no page has loaded. Fetch the row so the thread exists, gets its
          // parked messages and shows up in the sidebar right away.
          pushMessages([message]);

          if (
            !useBoundStore
              .getState()
              .chat.conversations.has(message.conversation_id)
          ) {
            const { data } = await supabase
              .from("conversations")
              .select()
              .eq("id", message.conversation_id)
              .maybeSingle();

            if (data) pushConversations([data]);
          }

          // Unread is a server-side count the store then tracks; only a live
          // arrival may move it (a page load must not).
          notifyRealtimeMessage(message);
        },
      );

    channel.subscribe();

    // Cleanup subscription on unmount
    return () => {
      channel.unsubscribe();
    };
  }, [activeOrgId]);
};
