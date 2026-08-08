import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type Database, supabase } from "@/supabase/client";
import useBoundStore from "@/stores/useBoundStore";
import { queryKeys } from "./queryKeys";

export type CalendarDeviceRow =
  Database["public"]["Tables"]["calendar_devices"]["Row"];

/**
 * Devices (phones, CalDAV clients) connected to one calendar.
 *
 * The `token` on these rows is the credential a device authenticates with, so
 * these queries are the only place it is read — it goes into a QR code and
 * nowhere else. Revoked rows are filtered out rather than deleted, so a
 * device's history stays auditable.
 */
export function useCalendarDevices(calendarId: string) {
  const userId = useBoundStore((state) => state.ui.user?.id);
  const orgId = useBoundStore((state) => state.ui.activeOrgId);

  return useQuery({
    queryKey: queryKeys.calendars.devices(orgId, calendarId),
    queryFn: async () =>
      await supabase
        .from("calendar_devices")
        .select()
        .eq("calendar_id", calendarId)
        .eq("organization_id", orgId!)
        .is("revoked_at", null)
        .order("created_at", { ascending: false })
        .throwOnError(),
    enabled: !!userId && !!orgId && !!calendarId,
    select: (data) => data.data as CalendarDeviceRow[],
  });
}

/**
 * Mint a sync link for a calendar.
 *
 * `token` and `secret` are both column defaults, so the database generates them
 * — the client never invents a credential.
 */
export function useCreateCalendarDevice() {
  const queryClient = useQueryClient();
  const orgId = useBoundStore((state) => state.ui.activeOrgId);

  return useMutation({
    mutationFn: async ({ calendarId }: { calendarId: string }) => {
      if (!orgId) throw new Error("No active organization");

      const { data } = await supabase
        .from("calendar_devices")
        .insert({ calendar_id: calendarId, organization_id: orgId })
        .select()
        .single()
        .throwOnError();

      return data as CalendarDeviceRow;
    },
    onSuccess: (device) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.calendars.devices(orgId, device.calendar_id),
      });
    },
  });
}

/**
 * Revoke a sync link.
 *
 * Sets `revoked_at` rather than deleting: the CalDAV server checks that column
 * on every request, so any phone already holding the token stops working
 * immediately, and the row remains as a record that the device existed.
 */
export function useRevokeCalendarDevice() {
  const queryClient = useQueryClient();
  const orgId = useBoundStore((state) => state.ui.activeOrgId);

  return useMutation({
    mutationFn: async ({
      id,
      calendarId,
    }: {
      id: string;
      calendarId: string;
    }) => {
      if (!orgId) throw new Error("No active organization");

      await supabase
        .from("calendar_devices")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", id)
        .eq("organization_id", orgId)
        .throwOnError();

      return { id, calendarId };
    },
    onSuccess: ({ calendarId }) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.calendars.devices(orgId, calendarId),
      });
    },
  });
}
