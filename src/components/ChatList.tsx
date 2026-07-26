import { useEffect, useMemo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import useBoundStore from "@/stores/useBoundStore";
import ChatListItem from "./ChatListItem";
import { timestampDescending } from "@/stores/chatSlice";
import { filters, Filters } from "@/stores/uiSlice";
import { useConversationsPage } from "@/queries/useConversationsPage";
import { useTranslation } from "@/hooks/useTranslation";
import Spinner from "./Spinner";

/** Row height (72px item + 4px gap) — items are fixed height, so no measuring. */
const ROW_HEIGHT = 76;

function pinnedAscending(a?: string | null, b?: string | null) {
  if (!a && !b) {
    return 0;
  }

  if (a && b) {
    return +new Date(a) > +new Date(b) ? 1 : -1;
  }

  return a && !b ? -1 : 1;
}

const ChatList = () => {
  const { translate: t } = useTranslation();
  const activeOrgId = useBoundStore((state) => state.ui.activeOrgId);
  const conversations = useBoundStore((state) => state.chat.conversations);
  const threads = useBoundStore((state) => state.chat.threads);
  const messages = useBoundStore((state) => state.chat.messages);
  const filterName = useBoundStore((state) => state.ui.filter);
  const setFilterName = useBoundStore((state) => state.ui.setFilter);
  const searchPattern = useBoundStore((state) => state.ui.searchPattern);
  const setSearchPattern = useBoundStore((state) => state.ui.setSearchPattern);
  const tagsFilter = useBoundStore((state) => state.ui.tagsFilter);
  const setTagsFilter = useBoundStore((state) => state.ui.setTagsFilter);

  // Filter, search and tags are applied by the RPC — with the list paginated,
  // narrowing client-side would only ever search the part already fetched.
  const {
    threadKeys,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useConversationsPage();

  const scroller = useRef<HTMLDivElement>(null);

  // The server decided *which* threads are here; ordering is re-derived locally
  // so a realtime message or a pin/archive reorders the list immediately,
  // without waiting for a refetch. The same predicates the RPC uses run here
  // too, so a chat archived in this session drops out at once.
  const itemIds = useMemo(() => {
    const describe = (key: string) => {
      const thread = threads.get(key);
      const conv = thread && conversations.get(thread.primaryConvId);
      const mostRecentMsg = messages.get(key)?.values().next().value;

      return { key, conv, mostRecentMsg, thread };
    };

    const loaded = threadKeys.map(describe);

    // A message can arrive over realtime for a thread no page has returned —
    // a first-time contact, or one that sat below the loaded window. It is
    // newer than everything on screen, so it belongs at the top; anything
    // older stays hidden until the next refetch places it properly.
    //
    // Only while the list is unnarrowed, though: search and tags are RPC-side
    // predicates with no local equivalent, so admitting a thread the server did
    // not return would show a non-matching chat. With the store still holding
    // the unfiltered list, that leaked every thread newer than the newest hit —
    // i.e. search looked like it filtered nothing at all.
    const narrowed = !!searchPattern || tagsFilter.length > 0;

    const newestLoadedAt = narrowed
      ? 0
      : loaded.reduce(
          (max, row) =>
            Math.max(max, +new Date(row.thread?.lastMessageAt ?? 0)),
          0,
        );

    const arrived = newestLoadedAt
      ? [...threads.values()]
          .filter(
            (thread) =>
              !threadKeys.includes(thread.key) &&
              +new Date(thread.lastMessageAt ?? 0) > newestLoadedAt,
          )
          .map((thread) => describe(thread.key))
      : [];

    const rows = [...loaded, ...arrived].filter(
      (row) =>
        row.conv &&
        row.conv.organization_id === activeOrgId &&
        filters[filterName](row.conv, row.mostRecentMsg),
    );

    return rows
      .sort(
        (a, b) =>
          pinnedAscending(a.conv!.extra?.pinned, b.conv!.extra?.pinned) ||
          timestampDescending(a.mostRecentMsg, b.mostRecentMsg),
      )
      .map((row) => row.key);
  }, [
    threadKeys,
    threads,
    conversations,
    messages,
    filterName,
    activeOrgId,
    searchPattern,
    tagsFilter,
  ]);

  // One extra row at the tail: the loading sentinel that pulls the next page.
  const count = itemIds.length + (hasNextPage ? 1 : 0);

  const virtualizer = useVirtualizer({
    count,
    getScrollElement: () => scroller.current,
    estimateSize: () => ROW_HEIGHT,
    getItemKey: (index) => itemIds[index] ?? "__sentinel__",
    overscan: 8,
  });

  const virtualItems = virtualizer.getVirtualItems();

  useEffect(() => {
    const last = virtualItems[virtualItems.length - 1];

    if (!last || !hasNextPage || isFetchingNextPage) return;

    if (last.index >= itemIds.length - 1) {
      void fetchNextPage();
    }
  }, [
    virtualItems,
    hasNextPage,
    isFetchingNextPage,
    itemIds.length,
    fetchNextPage,
  ]);

  return (
    <div
      ref={scroller}
      className="overflow-y-auto [scrollbar-gutter:stable] w-full h-full pt-[10px] px-[10px]"
    >
      {itemIds.length ? (
        <div
          className="relative w-full"
          style={{ height: virtualizer.getTotalSize() }}
        >
          {virtualItems.map((virtualRow) => (
            <div
              key={virtualRow.key}
              className="absolute top-0 left-0 w-full pb-[4px]"
              style={{
                height: ROW_HEIGHT,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {virtualRow.index < itemIds.length ? (
                <ChatListItem itemId={itemIds[virtualRow.index]} />
              ) : (
                <div className="h-full flex items-center justify-center">
                  <Spinner size={20} />
                </div>
              )}
            </div>
          ))}
        </div>
      ) : isLoading ? (
        <div className="h-full flex items-center justify-center">
          <Spinner size={24} />
        </div>
      ) : (
        <div className="h-full flex items-center justify-center flex-col text-foreground text-[15px] mt-[-24px]">
          {t("Nothing here")}
          {(searchPattern ||
            filterName !== Filters.ALL ||
            tagsFilter.length > 0) && (
            <button
              className="text-[13px] text-primary"
              onClick={() => {
                setSearchPattern("");
                setFilterName(Filters.ALL);
                setTagsFilter([]);
              }}
            >
              {t("remove filters...")}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default ChatList;
