import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/supabase/client";
import useBoundStore from "@/stores/useBoundStore";
import { queryKeys } from "./queryKeys";
import type { AppointmentRow } from "./useAppointments";

/**
 * Every appointment booked against one contact, newest first.
 *
 * `useAppointments` is keyed by calendar because the board draws one calendar
 * at a time; the contact page needs the other axis and there is no calendar to
 * narrow by, so this is its own query rather than a filter over that one.
 */
export function useContactAppointments(contactId: string) {
  const userId = useBoundStore((state) => state.ui.user?.id);
  const orgId = useBoundStore((state) => state.ui.activeOrgId);

  return useQuery({
    queryKey: queryKeys.contacts.appointments(orgId, contactId),
    queryFn: async () => {
      const { data } = await supabase
        .from("appointments")
        .select()
        .eq("organization_id", orgId!)
        .eq("contact_id", contactId)
        .order("starts_at", { ascending: false })
        .throwOnError();

      return (data ?? []) as AppointmentRow[];
    },
    enabled: !!userId && !!orgId && !!contactId,
  });
}
