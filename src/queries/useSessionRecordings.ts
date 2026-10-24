import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { type Database, supabase } from "@/supabase/client";
import useBoundStore from "@/stores/useBoundStore";
import { queryKeys } from "./queryKeys";
import { throwFunctionError } from "./throwFunctionError";

export type SessionRecordingRow =
  Database["public"]["Tables"]["session_recordings"]["Row"];

/** Seconds without a new piece before a recording counts as stopped early. */
const STOPPED_AFTER_SECONDS = 90;

export type WaitingRecording = SessionRecordingRow & {
  state: "writing" | "failed" | "stopped" | "unwritten";
};

/** Why a recording has no report yet, or null when it isn't waiting on
 *  anything (still recording on some screen, or done). */
export function waitingState(
  r: SessionRecordingRow,
): WaitingRecording["state"] | null {
  if (r.report_id || r.status === "deleted") return null;
  if (
    r.transcript_status === "transcribing" ||
    r.transcript_status === "writing"
  ) {
    return "writing";
  }
  if (r.transcript_status === "failed") return "failed";
  if (r.status === "ready") return "unwritten";
  return dayjs().diff(r.updated_at, "second") > STOPPED_AFTER_SECONDS
    ? "stopped"
    : null;
}

/** A patient's recordings that don't have a report yet. While one is being
 *  written, the list refreshes until its report appears. */
export function useWaitingRecordings(contactId: string) {
  const orgId = useBoundStore((state) => state.ui.activeOrgId);
  return useQuery({
    queryKey: queryKeys.sessionRecordings.contact(orgId, contactId),
    queryFn: async () => {
      const { data } = await supabase
        .from("session_recordings")
        .select()
        .eq("organization_id", orgId!)
        .eq("contact_id", contactId)
        .is("report_id", null)
        .neq("status", "deleted")
        .order("created_at", { ascending: false })
        .throwOnError();
      const rows = data ?? [];
      return rows.flatMap((r): WaitingRecording[] => {
        const state = waitingState(r);
        return state ? [{ ...r, state }] : [];
      });
    },
    enabled: !!orgId,
    // Often while a report is being written; otherwise once a minute, so a
    // recording whose browser closed shows up as stopped early.
    refetchInterval: (query) =>
      query.state.data?.some((r) => r.state === "writing") ? 10_000 : 60_000,
  });
}

export function useDeleteRecording() {
  const queryClient = useQueryClient();
  const orgId = useBoundStore((state) => state.ui.activeOrgId);
  return useMutation({
    mutationFn: async (recordingId: string) => {
      const { error } = await supabase.functions.invoke(
        `patient-data/recordings/${recordingId}`,
        { method: "DELETE" },
      );
      if (error) await throwFunctionError(error);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: [orgId, "session-recordings"],
      }),
  });
}
