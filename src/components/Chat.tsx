import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import dayjs from "dayjs";
import "dayjs/locale/es";
import "dayjs/locale/pt";
import localizedFormat from "dayjs/plugin/localizedFormat";
dayjs.extend(localizedFormat);
import useBoundStore from "@/stores/useBoundStore";
import Message from "./Message/Message";
import { type MessageRow } from "@/supabase/client";
import { useTranslation } from "@/hooks/useTranslation";
import { useCurrentOrganization } from "@/queries/useOrganizations";
import { useCurrentAgent } from "@/queries/useAgents";
import { AVATAR_COLORS } from "@/utils/colors";
import { useActiveConversation } from "@/hooks/useThread";
import { useCSWindow } from "@/hooks/useCSWindow";
import { useThreadMessages } from "@/queries/useThreadMessages";
import { useMarkThreadRead } from "@/queries/useMarkThreadRead";
import {
  indexReactions,
  isReactionRow,
  toggleReaction,
} from "@/utils/reactions";
import {
  channelKey,
  channelMessageId,
  indexByChannelId,
} from "@/utils/messageRefs";
import Spinner from "./Spinner";

/** Rough height of a text bubble; every row is measured after its first paint. */
const ESTIMATED_ROW_HEIGHT = 72;

/** How close to the top (in pixels) triggers loading the previous page. */
const LOAD_MORE_THRESHOLD_PX = 400;

/** Distance from the bottom that still counts as "following the conversation". */
const STICKY_BOTTOM_PX = 120;

/** How long the view keeps re-landing on the newest message after an open,
 *  while estimated row heights are replaced by measured ones. */
const PIN_SETTLE_MS = 1500;

type EnvelopeType = { message: MessageRow; first: boolean; last: boolean };
type SeparatorType = { text: string; first: true; last: true };

function Separator({ text }: { text: string }) {
  // TODO: just a placeholder
  const type: string = "date";

  return (
    <div
      className={
        "flex justify-center mb-[12px]" +
        (type === "unread" ? " py-[5px] bg-incoming-chat-bubble/25" : "")
      }
    >
      {/* unreads has rounded-16px px-22px py-0 but I prefer to keep the date style */}
      <div
        className={
          "px-[12px] pt-[4px] pb-[5px] capitalize text-[12px] bg-incoming-chat-bubble rounded-lg text-foreground" +
          (type === "unread" ? "" : " shadow")
        }
      >
        {text}
      </div>
    </div>
  );
}

export default function Chat() {
  const activeThreadKey = useBoundStore((store) => store.ui.activeThreadKey);
  const threadMessages = useBoundStore((store) =>
    store.chat.messages.get(store.ui.activeThreadKey || ""),
  );
  const messages = useMemo(
    () => Array.from(threadMessages?.values() ?? []),
    [threadMessages],
  );

  // Newest page first; older ones are pulled in as the user scrolls up.
  const { fetchNextPage, hasNextPage, isFetchingNextPage } =
    useThreadMessages(activeThreadKey);

  const { data: org } = useCurrentOrganization();
  const orgName = org?.name || "?";

  const conv = useActiveConversation();
  const convName = conv?.name || "?";

  // Reactions are messages too, so they obey the same 24-hour window the
  // composer does.
  const { inCSWindow } = useCSWindow();

  /* Reactions are stored as sibling message rows pointing at their target's
     external_id, not as a column on the target. Index them here — off the
     store's newest-first order, which `indexReactions` relies on — and hand
     each bubble its own. */
  const reactionsByTarget = useMemo(() => indexReactions(messages), [messages]);

  /* A reply's `re_message_id` names its target by the channel's id, so the row
     it points at has to be found by that rather than by our uuid. */
  const messagesByChannelId = useMemo(
    () => indexByChannelId(messages),
    [messages],
  );

  const setThreadReplyDraft = useBoundStore(
    (store) => store.chat.setThreadReplyDraft,
  );

  /** Message a quote jumped to, flashed briefly so the eye can find it. */
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  const { data: agent } = useCurrentAgent();
  const activeAgentId = agent?.id;
  const isAdmin = ["admin", "owner"].includes(agent?.extra?.role || "");

  const scroller = useRef<HTMLDivElement>(null);

  const { translate: t, currentLanguage } = useTranslation();

  function formatDate(timestamp: string): string {
    const dayjsTs = dayjs(timestamp).locale(currentLanguage);

    const days = dayjs().diff(dayjsTs.startOf("day"), "day", true);

    if (days < 1) return t("today");

    if (days < 2) return t("yesterday");

    if (days < 7) return dayjsTs.format("dddd"); // Jueves

    return dayjsTs.format("DD/MM/YYYY");
  }

  function getUniqueAgentIds(messages: MessageRow[] | undefined): Set<string> {
    if (!messages) return new Set();

    const agentIds = new Set<string>();

    for (const message of messages) {
      if (message.agent_id) {
        agentIds.add(message.agent_id);
      }
    }

    return agentIds;
  }

  function assignAgentColors(agentIds: Set<string>): Map<string, string> {
    const colorMap = new Map<string, string>();
    let colorIndex = 0;

    // Ensure consistent color assignment by sorting agent IDs
    const sortedAgentIds = Array.from(agentIds).sort();

    for (const agentId of sortedAgentIds) {
      colorMap.set(agentId, AVATAR_COLORS[colorIndex % AVATAR_COLORS.length]);
      colorIndex++;
    }

    return colorMap;
  }

  const colorMap = assignAgentColors(getUniqueAgentIds(messages));

  /** A bubble's reactions, plus how (or why not) it can be reacted to. */
  function reactionProps(message: MessageRow) {
    const reactions = message.external_id
      ? reactionsByTarget.get(channelKey(message.external_id))
      : undefined;

    // Tool traces and agent notes never reach a channel — no affordance at all.
    if (message.direction === "internal" || !conv) return { reactions };

    const reactDisabledReason =
      conv.service !== "whatsapp" && conv.service !== "instagram"
        ? t("Reactions are not supported on this channel")
        : !inCSWindow
          ? t("Outside the 24-hour window")
          : !message.external_id
            ? // No channel id yet: the send is still in flight.
              t("Still sending")
            : !channelMessageId(message)
              ? // Delivered, but the id the endpoint needs was never kept —
                // messages sent before the API started storing the raw WAMID.
                // Unbackfillable, so this is final.
                t("Reactions aren't available on this message")
              : undefined;

    if (reactDisabledReason) return { reactions, reactDisabledReason };

    return {
      reactions,
      onReact: (emoji: string) =>
        void toggleReaction({
          conv,
          target: message,
          emoji,
          agentId: activeAgentId,
          current: reactions?.find((r) => r.side === "org"),
        }).catch(console.error),
    };
  }

  /** Whether this bubble can be replied to, or why it cannot. */
  function replyProps(message: MessageRow) {
    // Tool traces and agent notes never reach a channel — no affordance at all.
    if (message.direction === "internal" || !conv) return {};

    /* Instagram is deliberately absent: the dispatcher has no way to attach a
       quote to an Instagram send (the Instagram-with-Instagram-Login messaging
       API documents `reply_to` only on the inbound webhook, never on the send
       payload — see instagram-dispatcher's `case "text"`). Offering Reply there
       would draw a quote in the CRM that the contact never sees. Incoming IG
       replies still render their quote; only sending one is unavailable. */
    const replyDisabledReason =
      conv.service !== "whatsapp" && conv.service !== "local"
        ? t("Replies are not supported on this channel")
        : !inCSWindow
          ? t("Outside the 24-hour window")
          : channelMessageId(message)
            ? undefined
            : !message.external_id
              ? // No channel id yet: the send is still in flight.
                t("Still sending")
              : // Delivered, but the id the endpoint needs was never kept.
                // Unbackfillable, so this is final.
                t("Replies aren't available on this message");

    if (replyDisabledReason) return { replyDisabledReason };

    return {
      onReply: () => setThreadReplyDraft(activeThreadKey || "", message.id),
    };
  }

  /** The message this one quotes, when it is a reply. */
  function quotedProps(message: MessageRow) {
    const { re_message_id, forwarded } = message.content;

    // `re_message_id` is overloaded across reply, reaction and forward; the
    // `forwarded` flag is what tells a forward apart, the same test the
    // dispatcher makes before sending a context.
    if (!re_message_id || forwarded) return {};

    const quoted = messagesByChannelId.get(channelKey(re_message_id));

    return {
      hasQuote: true,
      quoted,
      // Not loaded means not scrollable: paging backwards until it turns up is
      // unbounded, so the card stays inert instead.
      onJumpToQuoted: quoted ? () => jumpToMessage(quoted.id) : undefined,
    };
  }

  function jumpToMessage(messageId: string) {
    const index = rows.findIndex(
      (row) => "message" in row && row.message.id === messageId,
    );

    if (index < 0) return;

    // A jump into history outranks the opening pin on the newest message.
    releasePin();
    virtualizer.scrollToIndex(index, { align: "center" });
    setHighlightedId(messageId);
  }

  function getAgentAvatar(
    agentId: string | null,
  ): { agentId: string; color: string } | undefined {
    // Incoming messages don't have an agent id
    if (!agentId) return undefined;

    // Avatar is not needed for the user
    if (agentId === activeAgentId) return undefined;

    return { agentId, color: colorMap.get(agentId)! };
  }

  function insertDateSeparators(
    chat: MessageRow[],
  ): (EnvelopeType | SeparatorType)[] {
    const _chat = [];

    let prevMsg: EnvelopeType | null = null;

    for (const [_index, env] of chat
      .map(
        (message) => ({ message, first: false, last: false }) as EnvelopeType,
      )
      .entries()) {
      if (!prevMsg) {
        env.first = true;
        env.last = true;
      } else if (
        prevMsg.message.agent_id === env.message.agent_id &&
        prevMsg.message.direction === env.message.direction
      ) {
        prevMsg.last = false;
        env.last = true;
      } else if (
        prevMsg.message.agent_id !== env.message.agent_id ||
        prevMsg.message.direction !== env.message.direction
      ) {
        prevMsg.last = true;
        env.first = true;
        env.last = true;
      }

      if (
        !prevMsg ||
        dayjs(prevMsg.message.timestamp).isBefore(env.message.timestamp, "day")
      ) {
        _chat.push({
          text: formatDate(env.message.timestamp),
          first: true,
          last: true,
        } as SeparatorType);

        if (prevMsg) {
          prevMsg.last = true;
        }

        env.first = true;
      }

      _chat.push(env);

      prevMsg = env;
    }

    return _chat;
  }

  /* Actions that reset the unreads counter
   * ======================================
   *
   *   Inactive conversation
   *   ---------------------
   *   [x] Opening the conversation (conv goes active)
   *   [~] {X new messages} system message, it dissapears when conv goes inactive
   *   [ ] Scroll starts at system message
   *
   *   Active conversations
   *   --------------------
   *   [x] Sending a message
   *   [ ] Scrolling to bottom
   *
   * Scrolling behavior
   * ==================
   *
   * If at bottom, it sticks
   * New outgoing -> goes to bottom
   * New incoming -> stays at place
   *
   * Telegram:
   *   Remembers conv scroll position
   *   Re-activating the conv -> goes to bottom
   */

  // If the role is not admin, then do not show internal messages (tool calls, etc).
  const rows = insertDateSeparators(
    messages
      .filter((m, idx) => {
        // A reaction belongs on the bubble it points at, not on a line of its
        // own — `reactionsByTarget` has already claimed it.
        if (isReactionRow(m)) return false;

        if (isAdmin) return true;

        // Hide internal messages for non-admin users
        if (m.direction === "internal") return false;

        // @ts-expect-error draft is deprecated
        if (m.kind === "draft" && idx !== 0) return false;

        return true;
      })
      .reverse(),
  );

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scroller.current,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    // Bubbles are text, media and templates of wildly different heights, so
    // every row is measured once it paints.
    measureElement: (element) => element.getBoundingClientRect().height,
    // Keys must survive a prepend: indices shift when an older page lands.
    getItemKey: (index) => {
      const row = rows[index];
      return row && "message" in row ? row.message.id : `separator-${index}`;
    },
    overscan: 10,
  });

  const virtualItems = virtualizer.getVirtualItems();

  const scrollToBottom = (isSmooth: boolean = true) => {
    if (scroller.current) {
      scroller.current.scrollTo({
        top: scroller.current.scrollHeight,
        behavior: isSmooth ? "smooth" : "instant",
      });
    }
  };

  const isNearBottom = () => {
    const element = scroller.current;
    if (!element) return true;

    return (
      element.scrollHeight - element.scrollTop - element.clientHeight <
      STICKY_BOTTOM_PX
    );
  };

  /** Whether the reader is following the conversation, sampled on scroll. */
  const atBottom = useRef(true);

  /* Scrolling behavior
   * ==================
   *
   * Opening a conversation (and its first page landing) starts at the newest
   * message. A new message sticks to the bottom only if the reader is already
   * there — someone reading history is never yanked away from it. An older
   * page prepending must not move the viewport at all.
   */

  const previousThread = useRef<string | null>(null);
  const previousFirstKey = useRef<string | null>(null);
  const previousTotalSize = useRef(0);
  /** Guards the older-page trigger until the view has settled at the newest
   *  message; until then "scrolled to the top" is meaningless. */
  const initialScrollDone = useRef(false);

  /* The list is virtualized, so the jump on open aims at a `scrollHeight` built
     from estimated row heights. Once the real bubbles measure (and images
     finish downloading) the bottom moves, leaving the reader short of the last
     message. So opening pins the view to the bottom for a moment instead of
     scrolling once, and lets go as soon as the reader touches the wheel. */
  const pinnedToBottom = useRef(false);
  const pinTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentObserver = useRef<ResizeObserver | null>(null);

  const releasePin = () => {
    pinnedToBottom.current = false;
    if (pinTimer.current) {
      clearTimeout(pinTimer.current);
      pinTimer.current = null;
    }
  };

  const pinToBottom = () => {
    pinnedToBottom.current = true;
    if (pinTimer.current) clearTimeout(pinTimer.current);
    pinTimer.current = setTimeout(releasePin, PIN_SETTLE_MS);
  };

  useEffect(() => releasePin, []);

  // A bubble can also grow without a React commit — an image swapping its
  // placeholder height for the real one — so watch the sized element itself.
  const contentRef = useCallback((node: HTMLDivElement | null) => {
    contentObserver.current?.disconnect();
    contentObserver.current = null;

    if (!node) return;

    const observer = new ResizeObserver(() => {
      if (pinnedToBottom.current) scrollToBottom(false);
    });

    observer.observe(node);
    contentObserver.current = observer;
  }, []);

  // No dependency array: this has to run on every commit that can change the
  // rows, before the browser paints, or the jump would be visible.
  useLayoutEffect(() => {
    const element = scroller.current;
    if (!element) return;

    const first = rows[0];
    const firstKey = !first
      ? null
      : "message" in first
        ? first.message.id
        : first.text;
    const totalSize = virtualizer.getTotalSize();

    const remember = () => {
      previousFirstKey.current = firstKey;
      previousTotalSize.current = totalSize;
    };

    // Switching threads: start at the bottom, drop the previous anchor.
    if (previousThread.current !== activeThreadKey) {
      previousThread.current = activeThreadKey;
      initialScrollDone.current = false;
      remember();
      if (rows.length) {
        scrollToBottom(false);
        initialScrollDone.current = true;
        pinToBottom();
      }
      return;
    }

    // First page of an empty thread: same thing.
    if (!previousFirstKey.current) {
      remember();
      if (rows.length) {
        scrollToBottom(false);
        initialScrollDone.current = true;
        pinToBottom();
      }
      return;
    }

    // Still landing on the newest message: the bottom is still moving as rows
    // measure, so follow it rather than holding an offset.
    if (pinnedToBottom.current) {
      remember();
      if (rows.length) scrollToBottom(false);
      return;
    }

    // A different head means older messages were prepended: every row moved
    // down by the size of the new block, so the scroll offset follows it and
    // the reader stays on the message they were looking at.
    if (
      firstKey !== previousFirstKey.current &&
      totalSize > previousTotalSize.current
    ) {
      element.scrollTop += totalSize - previousTotalSize.current;
    }

    remember();
  });

  // A new message at the tail follows the reader only when they are at the
  // tail; the count also grows when an older page prepends, which must not
  // scroll anywhere.
  const newestMessage = rows.length
    ? (rows[rows.length - 1] as { message?: MessageRow }).message
    : undefined;
  const newestMessageId = newestMessage?.id;
  const newestIsOutgoing = newestMessage?.direction === "outgoing";
  const previousNewest = useRef(newestMessageId);
  useEffect(() => {
    if (previousNewest.current === newestMessageId) return;

    previousNewest.current = newestMessageId;

    // Sending always jumps to the message you just sent, wherever you were
    // reading. An incoming one only follows if you were at the tail —
    // `atBottom` is sampled while scrolling, not here: by now the new bubble is
    // in the DOM, and a tall one (an image, a template) would already have
    // pushed the reader out of the "near bottom" band.
    if (!newestIsOutgoing && !atBottom.current) return;

    const element = scroller.current;
    const distance = element
      ? element.scrollHeight - element.scrollTop - element.clientHeight
      : 0;

    // Animating a long way back from history would drag the viewport through
    // the load-older threshold; the resulting prepend rewrites scrollTop and
    // kills the animation halfway. Only the short hop is worth smoothing.
    scrollToBottom(distance < 2000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newestMessageId]);

  /* Read receipts.
   *
   * Opening a thread is the only thing on this side that honestly means "a
   * person read this", so it is the only thing that sends the blue ticks. The
   * agent stamps its own receipt when it replies (see `agent-client`); a turn
   * it stayed silent through leaves the thread unacknowledged, waiting here.
   *
   * Gated on visibility: a thread left open in a background tab has not been
   * read, so the listener re-runs the check when the tab comes back rather than
   * acknowledging on arrival. `lastMarked` keeps re-renders and thread
   * re-entries from re-POSTing; the RPC is idempotent regardless, and picks the
   * row to stamp itself. */
  const { mutate: markThreadRead } = useMarkThreadRead();
  const convIds = useBoundStore((store) =>
    store.chat.threads.get(store.ui.activeThreadKey || "")?.convIds,
  );
  const lastMarked = useRef<string | undefined>(undefined);

  // The last INBOUND row, not the last row. An agent turn that decides to stay
  // quiet still records an internal `[no reply sent: …]` note a few seconds
  // later, and admins see those — so the tail of the thread is routinely
  // `internal`, and keying off it would leave the contact's message
  // unacknowledged exactly when the agent chose not to answer, the case this
  // whole path exists for.
  let newestIncomingId: string | undefined;

  for (let i = rows.length - 1; i >= 0; i--) {
    const row = (rows[i] as { message?: MessageRow }).message;

    if (row?.direction === "incoming") {
      newestIncomingId = row.id;
      break;
    }
  }

  useEffect(() => {
    if (!activeThreadKey || !convIds?.length || !newestIncomingId) return;

    const mark = () => {
      if (document.visibilityState !== "visible") return;
      if (lastMarked.current === newestIncomingId) return;

      lastMarked.current = newestIncomingId;

      markThreadRead(convIds);
    };

    mark();

    document.addEventListener("visibilitychange", mark);

    return () => document.removeEventListener("visibilitychange", mark);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeThreadKey, newestIncomingId, convIds]);

  /* The composer's reply bar grows the footer and so shrinks this scroller,
     which the browser absorbs by leaving scrollTop alone — the newest message
     slides out of view. Follow it, but only for a reader who was already at
     the tail. */
  const replyDraft = useBoundStore((store) =>
    store.chat.replyDrafts.get(store.ui.activeThreadKey || ""),
  );

  useEffect(() => {
    if (replyDraft && atBottom.current) scrollToBottom(false);
  }, [replyDraft]);

  // The flash is a cue, not a state: drop it once the eye has had time to land.
  useEffect(() => {
    if (!highlightedId) return;

    const timer = setTimeout(() => setHighlightedId(null), 1500);

    return () => clearTimeout(timer);
  }, [highlightedId]);

  // Adjust scroll when visual viewport resizes (e.g. mobile keyboard opens)
  useEffect(() => {
    const handleResize = () => {
      if (isNearBottom()) scrollToBottom(false);
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", handleResize);
    }

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", handleResize);
      }
    };
  }, []);

  /**
   * Pulls the previous page when the reader approaches the top.
   *
   * Deliberately driven by the scroll offset rather than by the first rendered
   * index: on open, the rendered range legitimately starts at index 0 for a
   * moment (before the jump to the newest message), and an index-based trigger
   * reads that as "at the top" and walks the entire history in one burst —
   * exactly what paging exists to avoid.
   */
  const maybeLoadOlder = () => {
    const element = scroller.current;
    if (!element || !hasNextPage || isFetchingNextPage) return;
    if (!initialScrollDone.current) return;

    // Also load when the thread does not fill the viewport yet, otherwise a
    // short page leaves nothing to scroll and the history is unreachable.
    const notScrollable = element.scrollHeight <= element.clientHeight + 1;

    if (notScrollable || element.scrollTop < LOAD_MORE_THRESHOLD_PX) {
      void fetchNextPage();
    }
  };

  useEffect(maybeLoadOlder, [rows.length, hasNextPage, isFetchingNextPage]);

  return (
    activeThreadKey && (
      <div
        ref={scroller}
        onScroll={() => {
          atBottom.current = isNearBottom();
          // Leaving the bottom during the opening pin can only be the reader's
          // doing — a scrollbar drag reaches us as nothing but this event.
          if (!atBottom.current) releasePin();
          maybeLoadOlder();
        }}
        onWheel={releasePin}
        onTouchStart={releasePin}
        onKeyDown={releasePin}
        className="grow pb-[8px] overflow-y-auto [scrollbar-gutter:stable] relative"
      >
        {isFetchingNextPage && (
          <div className="sticky top-0 z-10 flex justify-center py-[8px]">
            <Spinner size={20} />
          </div>
        )}
        <div className="min-h-[12px]" />
        <div
          ref={contentRef}
          dir="ltr"
          className="relative w-full"
          style={{ height: virtualizer.getTotalSize() }}
        >
          {virtualItems.map((virtualRow) => {
            const row = rows[virtualRow.index];
            if (!row) return null;

            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                className="absolute top-0 left-0 w-full flex flex-col"
                style={{ transform: `translateY(${virtualRow.start}px)` }}
              >
                {"message" in row ? (
                  <Message
                    message={row.message}
                    first={row.first}
                    last={row.last}
                    orgName={orgName}
                    convName={convName}
                    avatar={getAgentAvatar(row.message.agent_id)}
                    highlight={highlightedId === row.message.id}
                    {...reactionProps(row.message)}
                    {...replyProps(row.message)}
                    {...quotedProps(row.message)}
                  />
                ) : (
                  <Separator text={row.text} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    )
  );
}
