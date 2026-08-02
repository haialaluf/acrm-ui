import type { Json } from "@/supabase/client";

export type MessageStatusKind =
  | "pending"
  | "sent"
  | "delivered"
  | "read"
  | "failed"
  | "cancelled";

/** Single status bucket for one recipient's message.status jsonb — terminal
 *  states first. Used only to LABEL a row (the single most-advanced thing
 *  that happened to it) — NOT for filtering, see messageMatchesStatus below:
 *  status keys accumulate (a delivered message still carries `accepted`), so
 *  a message can match multiple buckets at once and this exclusive pick
 *  would make "delivered" messages vanish from a "sent" filter. */
export function messageStatusKind(status: Json): MessageStatusKind {
  const s = (status ?? {}) as Record<string, unknown>;
  if (s.cancelled) return "cancelled";
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
  }
}

const KIND_LABELS: Record<MessageStatusKind, string> = {
  pending: "Pending",
  sent: "Sent",
  delivered: "Delivered",
  read: "Read",
  failed: "Failed",
  cancelled: "Cancelled",
};

export function messageStatusLabel(
  status: Json,
  t: (s: string) => string,
): string {
  return t(KIND_LABELS[messageStatusKind(status)]);
}
