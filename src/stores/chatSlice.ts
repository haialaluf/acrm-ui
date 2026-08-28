import type { ConversationRow, MessageRow } from "@/supabase/client";
import type { AppState } from "./useBoundStore";
import type { StateCreator } from "zustand";
// @ts-expect-error no type declarations for the core-js-pure submodule
import groupBy from "core-js-pure/actual/object/group-by";
import { type MessageRowV0, toV1 } from "@/supabase/messages-v0";
import { primaryConversation, threadKey } from "@/utils/ConversationUtils";

export function timestampDescending(a?: MessageRow, b?: MessageRow) {
  // Valid comparator: returns a signed number and 0 on ties. The previous
  // version returned only -1/1 (never 0), which is non-antisymmetric for equal
  // timestamps and makes V8's sort produce engine-dependent, unstable order.
  const ta = +new Date(a?.timestamp || 0);
  const tb = +new Date(b?.timestamp || 0);
  if (ta !== tb) return tb - ta;

  // Ties are common: WhatsApp delivers whole-second timestamps, and echoed
  // outgoing messages get their ms-disambiguated timestamp overwritten by
  // Meta's second-resolution one. created_at preserves the true insertion
  // order in those cases; id is the final, fully deterministic fallback.
  const ca = +new Date(a?.created_at || 0);
  const cb = +new Date(b?.created_at || 0);
  if (ca !== cb) return cb - ca;

  return (b?.id || "").localeCompare(a?.id || "");
}

export type FileDraft = {
  file: File;
  caption?: string;
};

type MediaLoad = {
  blob?: Blob;
  type: "upload" | "download";
  status: "pending" | "loading" | "done" | "error";
  error?: string;
  handledOnce?: boolean;
};

/**
 * A sidebar entry: every conversation row for one counterpart, plus the bits
 * the list needs without walking the (now paginated) message history.
 */
export type ThreadState = {
  key: string;
  /** Conversation rows of this thread, newest first. */
  convIds: string[];
  /** Row new messages are written to — see `primaryConversation`. */
  primaryConvId: string;
  /**
   * Unread incoming messages. Comes from `conversations_page` (which counts
   * server-side across the whole history) and is then kept live by realtime:
   * incoming bumps it, outgoing clears it. Never derived from the loaded
   * messages, which are only ever a window of the history.
   */
  unread: number;
  /** Timestamp of the newest loaded message; drives the sidebar ordering. */
  lastMessageAt: string | null;
};

/** One row of the `conversations_page` RPC, narrowed to what the store needs. */
export type ThreadPageRow = {
  thread_key: string;
  conversations: ConversationRow[];
  last_message: MessageRow | null;
  unread_count: number;
  pinned: boolean;
};

export type ChatState = {
  conversations: Map<string, ConversationRow>;
  threads: Map<string, ThreadState>;
  messages: Map<string, Map<string, MessageRow>>; // by thread key
  /** Messages that arrived before their conversation row did (realtime races).
   *  Flushed by `pushConversations`. */
  orphanMessages: Map<string, MessageRow[]>; // by conversation id
  textDrafts: Map<string, string>; // by thread key
  fileDrafts: Map<string, FileDraft[]>; // by thread key
  /** Message being replied to, by thread key. Holds our uuid, not the channel
   *  id: the row is resolved from `messages` when the quote is drawn and when
   *  the reply is sent. UI buffer only — never persisted to `conv.extra.draft`. */
  replyDrafts: Map<string, string>;
  mediaLoads: Map<string, MediaLoad>;
};

export type ChatActions = {
  pushConversations: (convs: ConversationRow[]) => void;
  /** Drops a deleted thread and everything derived from it. */
  removeThread: (key: string) => void;
  pushMessages: (msgs: MessageRow[]) => void;
  pushThreadPage: (rows: ThreadPageRow[]) => void;
  /** Realtime arrival — the only path that moves the unread counter. */
  notifyRealtimeMessage: (msg: MessageRow) => void;
  setMediaLoad: (messageId: string, mediaLoad: MediaLoad) => void;
  setThreadTextDraft: (threadKey: string, textDraft: string) => void;
  setThreadFileDrafts: (threadKey: string, drafts: FileDraft[]) => void;
  /** `null` clears the pending reply. */
  setThreadReplyDraft: (threadKey: string, messageId: string | null) => void;
  setThreadFileDraftCaption: (
    threadKey: string,
    draftIndex: number,
    caption: string,
  ) => void;
};

export type ChatSlice = ChatState & ChatActions;

/** Rebuilds a thread's derived fields from the conversation rows it owns. */
function deriveThread(
  key: string,
  convIds: string[],
  conversations: Map<string, ConversationRow>,
  previous?: ThreadState,
): ThreadState {
  const convs = convIds
    .map((id) => conversations.get(id))
    .filter(Boolean) as ConversationRow[];

  const primary = primaryConversation(convs);

  const sortedIds = [...convs]
    .sort((a, b) => +new Date(b.created_at || 0) - +new Date(a.created_at || 0))
    .map((c) => c.id);

  return {
    key,
    convIds: sortedIds.length ? sortedIds : convIds,
    primaryConvId: primary?.id ?? convIds[0],
    unread: previous?.unread ?? 0,
    lastMessageAt: previous?.lastMessageAt ?? null,
  };
}

/** Newest-first insert of `msgs` into a thread's message map. */
function mergeThreadMessages(
  cached: Map<string, MessageRow> | undefined,
  msgs: MessageRow[],
) {
  const merged = new Map(cached);

  for (const msg of msgs) {
    // skip push when the cached msg is more recent than the incoming msg
    const cachedUpdatedAt = merged.get(msg.id)?.updated_at;

    if (
      cachedUpdatedAt &&
      +new Date(cachedUpdatedAt) > +new Date(msg.updated_at)
    ) {
      continue;
    }

    merged.set(msg.id, msg);
  }

  return new Map(
    Array.from(merged.values())
      .sort(timestampDescending)
      .map((msg) => [msg.id, msg] as const),
  );
}

function toV1Messages(msgsMixedVersions: MessageRow[]) {
  return msgsMixedVersions
    .map((m) =>
      m.content.version === "1" ? m : toV1(m as unknown as MessageRowV0),
    )
    .filter(Boolean) as MessageRow[];
}

// @ts-expect-error partializing the slice creator's state type
export const createChatSlice: StateCreator<Partial<AppState>> = (
  set: (
    partial:
      | AppState
      | Partial<AppState>
      | ((state: AppState) => AppState | Partial<AppState>),
    replace?: boolean,
  ) => void,
) => ({
  conversations: new Map(),
  threads: new Map(),
  messages: new Map(),
  orphanMessages: new Map(),
  textDrafts: new Map(),
  fileDrafts: new Map(),
  replyDrafts: new Map(),
  mediaLoads: new Map(),
  pushConversations: (convs: ConversationRow[]) =>
    set((state) => applyConversations(state, convs)),
  removeThread: (key: string) => set((state) => removeThreadState(state, key)),
  pushMessages: (msgs: MessageRow[]) =>
    set((state) => applyMessages(state, msgs)),
  pushThreadPage: (rows: ThreadPageRow[]) =>
    set((state) => {
      let next = applyConversations(
        state,
        rows.flatMap((row) => row.conversations ?? []),
      );

      const lastMessages = rows
        .map((row) => row.last_message)
        .filter(Boolean) as MessageRow[];

      next = applyMessages({ ...state, ...next } as AppState, lastMessages);

      const threads = new Map(next.chat!.threads);

      for (const row of rows) {
        const thread = threads.get(row.thread_key);
        if (!thread) continue;

        threads.set(row.thread_key, {
          ...thread,
          unread: row.unread_count ?? 0,
        });
      }

      return { chat: { ...next.chat!, threads } };
    }),
  notifyRealtimeMessage: (msg: MessageRow) =>
    set((state) => {
      const conv = state.chat.conversations.get(msg.conversation_id);
      if (!conv) return {};

      const key = threadKey(conv);
      const thread = state.chat.threads.get(key);
      if (!thread) return {};

      // Only the contact's messages can make a thread unread; anything the
      // organization sends (from here or from the WhatsApp app) clears it —
      // the same rule the badge used when it walked the message list.
      const unread =
        msg.direction === "incoming"
          ? thread.unread + 1
          : msg.direction === "outgoing"
            ? 0
            : thread.unread;

      if (unread === thread.unread) return {};

      const threads = new Map(state.chat.threads);
      threads.set(key, { ...thread, unread });

      return { chat: { ...state.chat, threads } };
    }),
  setMediaLoad: (messageId: string, mediaLoad: MediaLoad) => {
    set((state) => {
      const mediaLoads = new Map(state.chat.mediaLoads);

      mediaLoads.set(messageId, { ...mediaLoad });

      return {
        chat: {
          ...state.chat,
          mediaLoads,
        },
      };
    });
  },
  setThreadTextDraft: (key: string, textDraft: string) => {
    set((state) => {
      const textDrafts = new Map(state.chat.textDrafts);

      textDrafts.set(key, textDraft);

      return {
        chat: {
          ...state.chat,
          textDrafts,
        },
      };
    });
  },
  setThreadReplyDraft: (key: string, messageId: string | null) => {
    set((state) => {
      const replyDrafts = new Map(state.chat.replyDrafts);

      if (messageId) {
        replyDrafts.set(key, messageId);
      } else {
        replyDrafts.delete(key);
      }

      return {
        chat: {
          ...state.chat,
          replyDrafts,
        },
      };
    });
  },
  setThreadFileDrafts: (key: string, fileDraftArray: FileDraft[]) => {
    set((state) => {
      const fileDrafts = new Map(state.chat.fileDrafts);

      fileDrafts.set(key, fileDraftArray);

      return {
        chat: {
          ...state.chat,
          fileDrafts,
        },
      };
    });
  },
  setThreadFileDraftCaption: (
    key: string,
    draftIndex: number,
    caption: string,
  ) => {
    set((state) => {
      const fileDrafts = new Map(state.chat.fileDrafts);

      const draft = fileDrafts.get(key) && fileDrafts.get(key)![draftIndex];

      if (!draft) {
        return {};
      }

      const fileDraftsArray = Array.from(fileDrafts.get(key)!);

      fileDraftsArray[draftIndex] = { ...draft, caption };

      fileDrafts.set(key, fileDraftsArray);

      return {
        chat: {
          ...state.chat,
          fileDrafts,
        },
      };
    });
  },
});

/* The two reducers below are shared by the actions above and by
 * `pushThreadPage`, which has to run both in a single `set`. */

function applyConversations(
  state: AppState,
  convs: ConversationRow[],
): Partial<AppState> {
  if (!convs.length) return {};

  const conversations = new Map(state.chat.conversations);
  const threads = new Map(state.chat.threads);
  const touched = new Map<string, Set<string>>();

  for (const conv of convs) {
    // skip push when the cached conv is more recent than the incoming conv
    const cachedUpdatedAt = conversations.get(conv.id)?.updated_at;

    if (
      cachedUpdatedAt &&
      +new Date(cachedUpdatedAt) > +new Date(conv.updated_at)
    ) {
      continue;
    }

    conversations.set(conv.id, conv);

    const key = threadKey(conv);
    const ids = touched.get(key) ?? new Set(threads.get(key)?.convIds ?? []);
    ids.add(conv.id);
    touched.set(key, ids);
  }

  for (const [key, ids] of touched) {
    threads.set(
      key,
      deriveThread(key, [...ids], conversations, threads.get(key)),
    );
  }

  const next: Partial<AppState> = {
    chat: { ...state.chat, conversations, threads },
  };

  // A conversation row landing may unblock messages that arrived first.
  const pending = [...touched.values()]
    .flatMap((ids) => [...ids])
    .flatMap((id) => state.chat.orphanMessages.get(id) ?? []);

  if (!pending.length) return next;

  const orphanMessages = new Map(state.chat.orphanMessages);
  for (const ids of touched.values()) {
    for (const id of ids) orphanMessages.delete(id);
  }

  return applyMessages(
    { ...state, chat: { ...next.chat!, orphanMessages } } as AppState,
    pending,
  );
}

function applyMessages(
  state: AppState,
  msgsMixedVersions: MessageRow[],
): Partial<AppState> {
  if (!msgsMixedVersions.length) return {};

  const now = Date.now();

  const msgs = toV1Messages(msgsMixedVersions)
    // Do not display scheduled messages (timestamp in the future). Compared
    // against the clock, not against updated_at: a send whose row is never
    // re-saved after its scheduled time — a cancelled one, say — keeps an
    // updated_at older than its timestamp forever, and the updated_at form
    // hid it for good. `conversations_page` picks the sidebar's last message
    // with the same `timestamp <= now()` rule, so dropping it here left the
    // thread with no message at all: blank preview, and sorted to the bottom
    // of the list as epoch 0 until opening it loaded the rest of its history.
    .filter((m) => +new Date(m.timestamp) <= now);

  const messages = new Map(state.chat.messages);
  const threads = new Map(state.chat.threads);
  let orphanMessages = state.chat.orphanMessages;

  const msgsByConv: { [key: string]: MessageRow[] } = groupBy(
    msgs,
    (msg: MessageRow) => msg.conversation_id,
  );

  const byThread = new Map<string, MessageRow[]>();

  for (const [convId, convMsgs] of Object.entries(msgsByConv)) {
    const conv = state.chat.conversations.get(convId);

    if (!conv) {
      // Realtime can deliver a message before its conversation row; park it
      // until `pushConversations` can tell us which thread it belongs to.
      if (orphanMessages === state.chat.orphanMessages) {
        orphanMessages = new Map(orphanMessages);
      }
      orphanMessages.set(convId, [
        ...(orphanMessages.get(convId) ?? []),
        ...convMsgs!,
      ]);
      continue;
    }

    const key = threadKey(conv);
    byThread.set(key, [...(byThread.get(key) ?? []), ...convMsgs!]);
  }

  for (const [key, threadMsgs] of byThread) {
    const merged = mergeThreadMessages(messages.get(key), threadMsgs);
    messages.set(key, merged);

    const thread = threads.get(key);
    const newest = merged.values().next().value as MessageRow | undefined;

    if (thread && newest) {
      threads.set(key, { ...thread, lastMessageAt: newest.timestamp });
    }
  }

  return {
    chat: { ...state.chat, messages, threads, orphanMessages },
  };
}

/**
 * Erases a thread from the store after its conversation rows were deleted.
 *
 * Everything keyed by the thread has to go, not just the row: a new message
 * from the same counterpart rebuilds a thread under the *same* key (see
 * `threadKey`), so a surviving message map or draft would resurrect history the
 * user just deleted.
 */
function removeThreadState(state: AppState, key: string): Partial<AppState> {
  const thread = state.chat.threads.get(key);

  const convIds = thread?.convIds ?? [];

  const conversations = new Map(state.chat.conversations);
  const threads = new Map(state.chat.threads);
  const messages = new Map(state.chat.messages);
  const orphanMessages = new Map(state.chat.orphanMessages);
  const textDrafts = new Map(state.chat.textDrafts);
  const fileDrafts = new Map(state.chat.fileDrafts);
  const replyDrafts = new Map(state.chat.replyDrafts);

  for (const id of convIds) {
    conversations.delete(id);
    orphanMessages.delete(id);
  }

  threads.delete(key);
  messages.delete(key);
  textDrafts.delete(key);
  fileDrafts.delete(key);
  replyDrafts.delete(key);

  return {
    chat: {
      ...state.chat,
      conversations,
      threads,
      messages,
      orphanMessages,
      textDrafts,
      fileDrafts,
      replyDrafts,
    },
  };
}
