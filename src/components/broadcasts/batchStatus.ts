export type BatchStatus =
  | "scheduled"
  | "sending"
  | "sent"
  | "failed"
  | "cancelled";

/** Derives a single display status from a list_broadcast_batches row — there
 *  is no stored status column (see that RPC's comment), so this mirrors the
 *  same precedence the earlier design-mockup version used. Still-pending
 *  takes priority (the batch isn't resolved yet); once resolved, an
 *  all-cancelled or all-failed outcome gets its own status, otherwise it
 *  reads as a plain "sent" (mixed/partial failures shown in the detail). */
export function batchStatus(row: {
  scheduled_date: string;
  recipient_count: number;
  pending_count: number;
  failed_count: number;
  cancelled_count: number;
}): BatchStatus {
  if (row.pending_count > 0) {
    const today = new Date().toISOString().slice(0, 10);
    return row.scheduled_date <= today ? "sending" : "scheduled";
  }
  if (row.cancelled_count > 0 && row.cancelled_count === row.recipient_count) {
    return "cancelled";
  }
  if (row.failed_count > 0 && row.failed_count === row.recipient_count) {
    return "failed";
  }
  return "sent";
}

/** Splits the two list tabs: a batch is "upcoming" while it still has
 *  messages that can go out (or be cancelled), and history once it doesn't. */
export function isUpcomingBatch(status: BatchStatus): boolean {
  return status === "scheduled" || status === "sending";
}

export function batchStatusTone(
  status: BatchStatus,
): "primary" | "warning" | "success" | "neutral" | "destructive" {
  switch (status) {
    case "scheduled":
      return "primary";
    case "sending":
      return "warning";
    case "sent":
      return "success";
    case "failed":
      return "destructive";
    case "cancelled":
      return "neutral";
  }
}

const STATUS_LABELS: Record<BatchStatus, string> = {
  scheduled: "Scheduled",
  sending: "Sending",
  sent: "Sent",
  failed: "Failed",
  cancelled: "Cancelled",
};

export function batchStatusLabel(
  status: BatchStatus,
  t: (s: string) => string,
): string {
  return t(STATUS_LABELS[status]);
}
