import type { Json } from "@/supabase/client";

export type MessageStatusKind =
  | "pending"
  | "sent"
  | "delivered"
  | "read"
  | "failed"
  | "cancelled"
  // Email only, written by email-webhook and email-dispatcher. Each is a
  // scalar timestamp key rather than an entry in status.errors, because the
  // merge_update trigger REPLACES arrays instead of merging them — a second
  // event for the same message overwrites the whole errors array.
  | "bounced"
  | "soft_bounced"
  | "complained"
  | "suppressed";

/** The email buckets, in the order the UI shows them. */
export const EMAIL_STATUS_KINDS = [
  "bounced",
  "soft_bounced",
  "complained",
  "suppressed",
] as const satisfies readonly MessageStatusKind[];

/** Single status bucket for one recipient's message.status jsonb — terminal
 *  states first. Used only to LABEL a row (the single most-advanced thing
 *  that happened to it) — NOT for filtering, see messageMatchesStatus below:
 *  status keys accumulate (a delivered message still carries `accepted`), so
 *  a message can match multiple buckets at once and this exclusive pick
 *  would make "delivered" messages vanish from a "sent" filter. */
export function messageStatusKind(status: Json): MessageStatusKind {
  const s = (status ?? {}) as Record<string, unknown>;
  if (s.cancelled) return "cancelled";
  // Before `failed`, and before `read`/`delivered`. These are the *reason* a
  // message failed, so showing the generic "Failed" instead would throw away
  // the only information the recipient row carries — it is what made an invalid
  // address indistinguishable from a broken template.
  //
  // `complained` outranks `delivered` and `read` for a different reason: a
  // complaint means the mail arrived and was reported as spam, so the row does
  // legitimately carry `delivered` too. Labelling it "Delivered" is technically
  // true and practically useless — the spam report is the thing worth knowing.
  if (s.suppressed) return "suppressed";
  if (s.bounced) return "bounced";
  if (s.soft_bounced) return "soft_bounced";
  if (s.complained) return "complained";
  if (s.failed) return "failed";
  if (s.read) return "read";
  if (s.delivered) return "delivered";
  if (s.accepted || s.sent) return "sent";
  return "pending";
}

/** Inclusive membership test, mirroring list_broadcast_batches's own
 *  `count(*) filter (...)` predicates exactly (sent/delivered/read/failed/
 *  cancelled all just check "is this key present", so a delivered message
 *  counts as both sent AND delivered — only "pending" is exclusive, since
 *  its SQL predicate requires every later key to be absent). Filtering the
 *  recipient list by a clicked stat tile must use this, not
 *  messageStatusKind, so the filtered count matches the tile's own count. */
export function messageMatchesStatus(
  status: Json,
  kind: MessageStatusKind,
): boolean {
  const s = (status ?? {}) as Record<string, unknown>;
  switch (kind) {
    case "pending":
      return (
        !!s.pending &&
        !s.accepted &&
        !s.sent &&
        !s.delivered &&
        !s.read &&
        !s.failed &&
        !s.cancelled
      );
    case "sent":
      return !!s.accepted || !!s.sent;
    case "delivered":
      return !!s.delivered;
    case "read":
      return !!s.read;
    case "failed":
      return !!s.failed;
    case "cancelled":
      return !!s.cancelled;
    // Same "is the key present" shape as the SQL counterparts in
    // list_broadcast_batches, so a clicked tile filters to exactly its count.
    case "bounced":
      return !!s.bounced;
    case "soft_bounced":
      return !!s.soft_bounced;
    case "complained":
      return !!s.complained;
    case "suppressed":
      return !!s.suppressed;
  }
}

const KIND_LABELS: Record<MessageStatusKind, string> = {
  pending: "Pending",
  sent: "Sent",
  delivered: "Delivered",
  read: "Read",
  failed: "Failed",
  cancelled: "Cancelled",
  bounced: "Bounced",
  soft_bounced: "Soft bounced",
  complained: "Reported as spam",
  suppressed: "Not sent — opted out",
};

/** Where the two channels genuinely mean different things by the same key.
 *  `read` on WhatsApp is a read receipt; on email it is an SES `Open` event,
 *  i.e. the tracking pixel loaded — which plenty of clients block, so calling
 *  it "Read" would overstate it. Everything else reads the same either way. */
const EMAIL_KIND_LABELS: Partial<Record<MessageStatusKind, string>> = {
  read: "Opened",
};

/** Label for one bucket. Split out from messageStatusLabel so a row can be
 *  labelled by the bucket the user filtered to rather than by the message's
 *  own furthest state. */
export function messageKindLabel(
  kind: MessageStatusKind,
  t: (s: string) => string,
  service?: string | null,
): string {
  return t(
    (service === "email" ? EMAIL_KIND_LABELS[kind] : undefined) ??
      KIND_LABELS[kind],
  );
}

export function messageStatusLabel(
  status: Json,
  t: (s: string) => string,
  service?: string | null,
): string {
  return messageKindLabel(messageStatusKind(status), t, service);
}

/**
 * When one bucket was reached, from the ISO timestamp its own status key
 * holds (see OutgoingStatus — every key is a `new Date().toISOString()`).
 * Null when the message never reached that state.
 *
 * `pending` deliberately has none: its timestamp is when the broadcast was
 * *queued*, which for a scheduled batch is hours before it goes out — the
 * caller shows messages.timestamp (the send slot) instead, which is what
 * "Pending" is actually waiting for.
 */
export function messageStatusTime(
  status: Json,
  kind: MessageStatusKind,
): string | null {
  const s = (status ?? {}) as Record<string, unknown>;
  // `sent` covers two keys: the dispatcher writes `accepted` when the provider
  // takes the message, the webhook writes `sent` when it actually leaves.
  // Prefer the latter, fall back to the former.
  const raw = kind === "sent" ? (s.sent ?? s.accepted) : s[kind];
  return kind === "pending" || typeof raw !== "string" ? null : raw;
}
