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
 *  - an `updated_at` sweep over the conversations already in the store catches
 *    edits to messages that are loaded (delivery/read receipts, media that
 *    finished processing), which no page refetch would surface because those
 *    rows keep their old timestamp.
 */

// PostgREST sends `in.(...)` in the query string, so the id list has to stay
// clear of the 8KB request-line limit however far the reader has scrolled the
// sidebar. Batches are issued together, not serially.
const SWEEP_CHUNK_SIZE = 100;
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

      // Only conversations we hold: a message from any other thread would sit
      // in the orphan buffer waiting for a conversation row that never
      // arrives. Scoping the query rather than filtering its result is what
      // keeps the row budget on threads that are actually on screen -- the
      // org-wide form spent all 999 rows on threads the reader had never paged
      // to and then dropped them. It also keeps this off a full scan, since
      // messages.updated_at is deliberately unindexed (03-05_messages.sql).
      const known = [...useBoundStore.getState().chat.conversations.keys()];

      const batches = await Promise.all(
        Array.from(
          { length: Math.ceil(known.length / SWEEP_CHUNK_SIZE) },
          (_, i) =>
            supabase
              .from("messages")
              .select()
              .in(
                "conversation_id",
                known.slice(i * SWEEP_CHUNK_SIZE, (i + 1) * SWEEP_CHUNK_SIZE),
              )
              .gt("updated_at", since.toISOString())
              .order("updated_at", { ascending: false })
              .limit(999)
              .throwOnError(),
        ),
      );

      pushMessages(batches.flatMap((batch) => batch.data ?? []));

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
