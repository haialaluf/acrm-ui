import { useEffect, useMemo, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/supabase/client";
import useBoundStore from "@/stores/useBoundStore";
import type { ThreadPageRow } from "@/stores/chatSlice";
import { Filters } from "@/stores/uiSlice";
import { queryKeys } from "./queryKeys";

/** Threads per request. The sidebar is virtualized, so this is a network
 *  batch size, not a render budget. */
export const CONVERSATIONS_PAGE_SIZE = 200;

const SEARCH_DEBOUNCE_MS = 300;

/** Keyset position: the last message of the last non-pinned thread of a page. */
type Cursor = { ts: string; id: string } | null;

/** UI filter names are Spanish legacy; the RPC speaks these. */
const FILTER_PARAM: Record<string, string> = {
  [Filters.ALL]: "all",
  [Filters.UNREAD]: "unread",
  [Filters.H24]: "h24",
  [Filters.ARCHIVED]: "archived",
};

function useDebounced<T>(value: T, delay: number) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

/**
 * The sidebar's conversation list, paged newest-first.
 *
 * Filter, search and tags are applied by `conversations_page` server-side —
 * with only a window of the conversations loaded, filtering client-side would
 * silently hide matches that live further down the list.
 *
 * The rows themselves go straight into the zustand store (`pushThreadPage`),
 * which stays the single source components render from; this query only owns
 * the paging state and the order threads came back in. Returning just the keys
 * keeps one copy of every conversation and message in memory instead of two.
 */
export function useConversationsPage() {
  const userId = useBoundStore((state) => state.ui.user?.id);
  const orgId = useBoundStore((state) => state.ui.activeOrgId);
  const filter = useBoundStore((state) => state.ui.filter);
  const searchPattern = useBoundStore((state) => state.ui.searchPattern);
  const tagsFilter = useBoundStore((state) => state.ui.tagsFilter);
  const pushThreadPage = useBoundStore((state) => state.chat.pushThreadPage);

  // Typing must not fire one RPC per keystroke. Trimmed because the pattern
  // goes to the RPC as `%value%` — a pasted number with a trailing space would
  // otherwise match nothing.
  const search = useDebounced(searchPattern, SEARCH_DEBOUNCE_MS).trim();

  const query = useInfiniteQuery({
    queryKey: queryKeys.conversations.page(orgId, filter, search, tagsFilter),
    initialPageParam: null as Cursor,
    queryFn: async ({ pageParam }) => {
      const { data } = await supabase
        .rpc("conversations_page", {
          p_organization_id: orgId!,
          p_limit: CONVERSATIONS_PAGE_SIZE,
          p_before_ts: pageParam?.ts,
          p_before_id: pageParam?.id,
          p_filter: FILTER_PARAM[filter] ?? "all",
          p_search: search || undefined,
          p_tags: tagsFilter.length ? tagsFilter : undefined,
        })
        .throwOnError();

      const rows = (data ?? []) as unknown as ThreadPageRow[];

      pushThreadPage(rows);

      // Pinned threads ride along on the first page and are not part of the
      // keyset stream, so the cursor has to come from the last unpinned row.
      const streamed = rows.filter((row) => !row.pinned);
      const last = streamed[streamed.length - 1]?.last_message;

      return {
        keys: rows.map((row) => row.thread_key),
        streamed: streamed.length,
        cursor: last ? { ts: last.timestamp, id: last.id } : null,
      };
    },
    getNextPageParam: (lastPage) =>
      lastPage.streamed >= CONVERSATIONS_PAGE_SIZE
        ? lastPage.cursor
        : undefined,
    enabled: !!userId && !!orgId,
    staleTime: 30_000,
    // Refetching an infinite query replays *every* page it holds, so a tab
    // regaining focus would fire one RPC per loaded page. Freshness comes from
    // realtime and from the explicit invalidation in `useChatSync`.
    refetchOnWindowFocus: false,
  });

  // Server order, deduplicated: a thread can reappear across pages when a
  // message lands while the user is paging.
  const threadKeys = useMemo(() => {
    const seen = new Set<string>();

    return (query.data?.pages ?? []).flatMap((page) =>
      page.keys.filter((key) => {
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }),
    );
  }, [query.data]);

  return {
    threadKeys,
    fetchNextPage: query.fetchNextPage,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
  };
}
