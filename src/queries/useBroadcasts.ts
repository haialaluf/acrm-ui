import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type Database, supabase } from "@/supabase/client";
import useBoundStore from "@/stores/useBoundStore";
import { queryKeys } from "./queryKeys";

/**
 * One row of useBroadcastBatches — a single day-batch of a broadcast.
 *
 * `scheduled_at` (the batch's exact send instant, as opposed to `scheduled_date`,
 * its day) and `activity_at` (when the batch actually resolved — sent, failed or
 * cancelled) are spliced in by hand because db_types.ts is regenerated from the
 * live database and these columns ship with the migrations that add them. Drop
 * the intersection — not the fields, which the generated type will then carry
 * on its own — after the next `supabase gen types` run.
 */
export type BroadcastBatchRow =
  Database["public"]["Functions"]["list_broadcast_batches"]["Returns"][number] & {
    scheduled_at: string | null;
    activity_at: string | null;
  };

/**
 * One row per batch — a distinct sending day within one broadcast "campaign".
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
    // Cast for the same reason as the type above: the RPC really does return
    // scheduled_at and activity_at, the generated types just don't know it yet.
    select: (data) => (data.data ?? []) as BroadcastBatchRow[],
  });
}

/**
 * Recipient list for one batch, identified the same way
 * list_broadcast_batches keys it: the campaign's created_at plus the batch's
 * scheduled_date.
 */
export function useBroadcastBatchMessages(
  createdAt: string | null,
  scheduledDate: string | null,
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
    select: (data) => data.data ?? [],
  });
}

/** Cancels every still-pending message in one batch. No-ops (0 rows) for any
 *  message the dispatcher already picked up — see cancel_broadcast_batch. */
export function useCancelBroadcastBatch() {
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
        .rpc("cancel_broadcast_batch", {
          p_organization_id: orgId,
          p_created_at: createdAt,
          p_scheduled_date: scheduledDate,
        })
        .throwOnError();

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.broadcasts.batches(orgId),
      });
    },
  });
}
