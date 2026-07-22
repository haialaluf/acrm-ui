import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type Database, supabase } from "@/supabase/client";
import useBoundStore from "@/stores/useBoundStore";
import { queryKeys } from "./queryKeys";

export type AppointmentRow =
  Database["public"]["Tables"]["appointments"]["Row"];
export type AppointmentInsert =
  Database["public"]["Tables"]["appointments"]["Insert"];
export type AppointmentUpdate =
  Database["public"]["Tables"]["appointments"]["Update"];

// All appointments for a calendar, ordered chronologically. The board fetches
// the whole calendar and filters by the visible range client-side — appointment
// volumes per calendar are small enough that range-windowing isn't worth it.
export function useAppointments(calendarId: string) {
  const userId = useBoundStore((state) => state.ui.user?.id);
  const orgId = useBoundStore((state) => state.ui.activeOrgId);

  return useQuery({
    queryKey: queryKeys.appointments.all(orgId, calendarId),
    queryFn: async () =>
      await supabase
        .from("appointments")
        .select()
        .eq("organization_id", orgId!)
        .eq("calendar_id", calendarId)
        .order("starts_at", { ascending: true })
        .throwOnError(),
    enabled: !!userId && !!orgId && !!calendarId,
    select: (data) => data.data as AppointmentRow[],
  });
}

export function useCreateAppointment() {
  const queryClient = useQueryClient();
  const orgId = useBoundStore((state) => state.ui.activeOrgId);

  return useMutation({
    mutationFn: async (data: Omit<AppointmentInsert, "organization_id">) => {
      if (!orgId) throw new Error("No active organization");

      const { data: appointment } = await supabase
        .from("appointments")
        .insert({ ...data, organization_id: orgId })
        .select()
        .single()
        .throwOnError();

      return appointment;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.appointments.all(orgId, data.calendar_id),
      });
    },
  });
}

export function useUpdateAppointment() {
  const queryClient = useQueryClient();
  const orgId = useBoundStore((state) => state.ui.activeOrgId);

  return useMutation({
    mutationFn: async ({ id, ...data }: AppointmentUpdate & { id: string }) => {
      if (!orgId) throw new Error("No active organization");

      const { data: appointment } = await supabase
        .from("appointments")
        .update(data)
        .eq("id", id)
        .eq("organization_id", orgId)
        .select()
        .single()
        .throwOnError();

      return appointment;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.appointments.all(orgId, data.calendar_id),
      });
    },
  });
}

export function useDeleteAppointment() {
  const queryClient = useQueryClient();
  const orgId = useBoundStore((state) => state.ui.activeOrgId);

  return useMutation({
    mutationFn: async ({
      id,
    }: {
      id: string;
      // calendar_id is unused server-side but lets onSuccess target the cache.
      calendar_id: string;
    }) => {
      if (!orgId) throw new Error("No active organization");

      await supabase
        .from("appointments")
        .delete()
        .eq("id", id)
        .eq("organization_id", orgId)
        .throwOnError();
    },
    onSuccess: (_data, { calendar_id }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.appointments.all(orgId, calendar_id),
      });
    },
  });
}
