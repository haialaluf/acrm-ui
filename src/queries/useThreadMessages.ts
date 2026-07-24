import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { supabase } from "@/supabase/client";
import type { MessageRow } from "@/supabase/client";
import useBoundStore from "@/stores/useBoundStore";
import { parseThreadKey } from "@/utils/ConversationUtils";
import { queryKeys } from "./queryKeys";

/** Messages per request while scrolling back through a conversation. */
export const MESSAGES_PAGE_SIZE = 200;

type Cursor = { ts: string; id: string } | null;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolves a thread key to its conversation rows when the store does not know
 * it yet — i.e. on a deep link (`/conversations#<threadKey>`) to a thread that
 * no loaded page contains. Idle otherwise.
 */
export function useThreadConversations(threadKey: string | null) {
  const userId = useBoundStore((state) => state.ui.user?.id);
  const orgId = useBoundStore((state) => state.ui.activeOrgId);
  const known = useBoundStore((state) =>
    threadKey ? !!state.chat.threads.get(threadKey) : false,
  );
  const pushConversations = useBoundStore(
    (state) => state.chat.pushConversations,
  );

  return useQuery({
    queryKey: queryKeys.conversations.thread(orgId, threadKey),
    queryFn: async () => {
      const { organizationAddress, counterpart } = parseThreadKey(threadKey!);

      // The counterpart is a contact address, a group address, or — for the
      // `local` agent chats, which have neither — the conversation id itself.
      const matches = [
        `contact_address.eq."${counterpart}"`,
        `group_address.eq."${counterpart}"`,
        ...(UUID.test(counterpart) ? [`id.eq.${counterpart}`] : []),
      ];

      const { data } = await supabase
        .from("conversations")
        .select()
        .eq("organization_id", orgId!)
        .eq("organization_address", organizationAddress)
        .or(matches.join(","))
        .throwOnError();

      pushConversations(data ?? []);

      return data ?? [];
    },
    enabled: !!userId && !!orgId && !!threadKey && !known,
    staleTime: 60_000,
  });
}

/**
 * The open conversation's history, oldest pages fetched on demand.
 *
 * Spans every conversation row of the thread, so a counterpart whose history
 * was split across a closed and a reopened conversation reads as one timeline.
 * Pages are keyset-cursored on (timestamp, id): plain `lt(timestamp)` would
 * drop messages whenever a batch shares a timestamp, which broadcast sends
 * produce by the hundred.
 *
 * Like `useConversationsPage`, rows land in the zustand store and this query
 * keeps only the cursor.
 */
export function useThreadMessages(threadKey: string | null) {
  const userId = useBoundStore((state) => state.ui.user?.id);
  const orgId = useBoundStore((state) => state.ui.activeOrgId);
  const convIds = useBoundStore((state) =>
    threadKey ? state.chat.threads.get(threadKey)?.convIds : undefined,
  );
  const pushMessages = useBoundStore((state) => state.chat.pushMessages);

  useThreadConversations(threadKey);

  return useInfiniteQuery({
    // The conversation rows are part of the key: a thread that gains a row
    // (a closed conversation reopened) has to page over the new set.
    queryKey: [
      ...queryKeys.conversations.messages(orgId, threadKey),
      (convIds ?? []).join(","),
    ],
    initialPageParam: null as Cursor,
    queryFn: async ({ pageParam }) => {
      let request = supabase
        .from("messages")
        .select()
        .eq("organization_id", orgId!)
        .in("conversation_id", convIds!)
        // Scheduled sends are not history yet.
        .lte("timestamp", new Date().toISOString())
        .order("timestamp", { ascending: false })
        .order("id", { ascending: false })
        .limit(MESSAGES_PAGE_SIZE);

      if (pageParam) {
        request = request.or(
          `timestamp.lt."${pageParam.ts}",` +
            `and(timestamp.eq."${pageParam.ts}",id.lt.${pageParam.id})`,
        );
      }

      const { data } = await request.throwOnError();

      const messages = (data ?? []) as MessageRow[];

      pushMessages(messages);

      const oldest = messages[messages.length - 1];

      return {
        count: messages.length,
        cursor: oldest ? { ts: oldest.timestamp, id: oldest.id } : null,
      };
    },
    getNextPageParam: (lastPage) =>
      lastPage.count >= MESSAGES_PAGE_SIZE ? lastPage.cursor : undefined,
    enabled: !!userId && !!orgId && !!threadKey && !!convIds?.length,
    // History does not change behind our back: new messages arrive over
    // realtime and edits (receipts, media) come through the visibility sweep.
    // Without this, every focus event refetches all the pages scrolled so far.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}
