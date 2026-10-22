import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type Database, supabase } from "@/supabase/client";
import useBoundStore from "@/stores/useBoundStore";
import { queryKeys } from "./queryKeys";

/**
 * One row of useBroadcastBatches - a single day-batch of a broadcast.
 *
 * `scheduled_at` (the batch's exact send instant, as opposed to `scheduled_date`,
 * its day) and `activity_at` (when the batch actually resolved - sent, failed or
 * cancelled) are spliced in by hand because db_types.ts is regenerated from the
 * live database and these columns ship with the migrations that add them. Drop
 * the intersection - not the fields, which the generated type will then carry
 * on its own - after the next `supabase gen types` run.
 */
export type BroadcastBatchRow =
  Database["public"]["Functions"]["list_broadcast_batches"]["Returns"][number] & {
    scheduled_at: string | null;
    activity_at: string | null;
  };

/**
 * One row per batch - a distinct sending day within one broadcast "campaign".
 * Broadcasts have no dedicated table; list_broadcast_batches derives them from
 * `messages` (see its own SQL comment for the exact campaign/batch key), so
 * this is the read side of the broadcast-status page's list.
 */
export function useBroadcastBatches() {
  const userId = useBoundStore((state) => state.ui.user?.id);
  const orgId = useBoundStore((state) => state.ui.activeOrgId);

  return useQuery({
    queryKey: queryKeys.broadcasts.batches(orgId),
    queryFn: async () =>
      await supabase
        .rpc("list_broadcast_batches", { p_organization_id: orgId! })
        .throwOnError(),
    enabled: !!userId && !!orgId,
    refetchInterval: (query) =>
      (query.state.data?.data ?? []).some(isDispatching)
        ? LIVE_REFRESH_MS
        : false,
    // Cast for the same reason as the type above: the RPC really does return
    // scheduled_at and activity_at, the generated types just don't know it yet.
    select: (data) => (data.data ?? []) as BroadcastBatchRow[],
  });
}

const LIVE_REFRESH_MS = 15_000;

/** Messages of this batch are going out right now, so its counts move. */
export function isDispatching(row: {
  pending_count: number;
  paused_count: number;
  scheduled_at: string | null;
}): boolean {
  return (
    row.pending_count > row.paused_count &&
    !!row.scheduled_at &&
    new Date(row.scheduled_at).getTime() <= Date.now()
  );
}

/**
 * Recipient list for one batch, identified the same way
 * list_broadcast_batches keys it: the campaign's created_at plus the batch's
 * scheduled_date.
 */
export function useBroadcastBatchMessages(
  createdAt: string | null,
  scheduledDate: string | null,
  live = false,
) {
  const userId = useBoundStore((state) => state.ui.user?.id);
  const orgId = useBoundStore((state) => state.ui.activeOrgId);

  return useQuery({
    queryKey: queryKeys.broadcasts.batchMessages(
      orgId,
      createdAt,
      scheduledDate,
    ),
    queryFn: async () =>
      await supabase
        .rpc("broadcast_batch_messages", {
          p_organization_id: orgId!,
          p_created_at: createdAt!,
          p_scheduled_date: scheduledDate!,
        })
        .throwOnError(),
    enabled: !!userId && !!orgId && !!createdAt && !!scheduledDate,
    refetchInterval: live ? LIVE_REFRESH_MS : false,
    select: (data) => data.data ?? [],
  });
}

type BatchActionRpc =
  | "cancel_broadcast_batch"
  | "pause_broadcast_batch"
  | "resume_broadcast_batch";

function useBroadcastBatchAction(rpc: BatchActionRpc) {
  const queryClient = useQueryClient();
  const orgId = useBoundStore((state) => state.ui.activeOrgId);

  return useMutation({
    mutationFn: async ({
      createdAt,
      scheduledDate,
    }: {
      createdAt: string;
      scheduledDate: string;
    }) => {
      if (!orgId) throw new Error("No active organization");

      const { data } = await supabase
        .rpc(rpc, {
          p_organization_id: orgId,
          p_created_at: createdAt,
          p_scheduled_date: scheduledDate,
        })
        .throwOnError();

      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.broadcasts.batches(orgId),
      });
    },
  });
}

/** Cancels every still-pending message in one batch, paused ones included.
 *  No-ops (0 rows) for any message the dispatcher already picked up - see
 *  cancel_broadcast_batch. */
export function useCancelBroadcastBatch() {
  return useBroadcastBatchAction("cancel_broadcast_batch");
}

/** Holds the batch's unsent messages until resumed. A message already being
 *  handed to the provider may still go out. */
export function usePauseBroadcastBatch() {
  return useBroadcastBatchAction("pause_broadcast_batch");
}

/** Messages whose slot is more than 6 hours old are re-slotted to now, which
 *  can move them into a new batch dated today - see resume_broadcast_batch. */
export function useResumeBroadcastBatch() {
  return useBroadcastBatchAction("resume_broadcast_batch");
}
