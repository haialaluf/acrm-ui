import {
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { type Database, supabase } from "@/supabase/client";
import useBoundStore from "@/stores/useBoundStore";
import { queryKeys } from "./queryKeys";

export type AppointmentRow =
  Database["public"]["Tables"]["appointments"]["Row"];
export type AppointmentInsert =
  Database["public"]["Tables"]["appointments"]["Insert"];
export type AppointmentUpdate =
  Database["public"]["Tables"]["appointments"]["Update"];

function invalidateAppointments(
  queryClient: QueryClient,
  orgId: string | null,
  appointment: { contact_id?: string | null },
) {
  void queryClient.invalidateQueries({
    queryKey: queryKeys.appointments.org(orgId),
  });
  if (appointment.contact_id) {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.contacts.appointments(orgId, appointment.contact_id),
    });
  }
}

/** The next scheduled session per contact, for the patients list. */
export function useNextAppointmentByContact(enabled: boolean) {
  const userId = useBoundStore((state) => state.ui.user?.id);
  const orgId = useBoundStore((state) => state.ui.activeOrgId);

  return useQuery({
    queryKey: queryKeys.appointments.upcoming(orgId),
    queryFn: async () => {
      const { data } = await supabase
        .from("appointments")
        .select("contact_id, starts_at")
        .eq("organization_id", orgId!)
        .not("contact_id", "is", null)
        .neq("status", "cancelled")
        .gte("starts_at", new Date().toISOString())
        .order("starts_at", { ascending: true })
        .throwOnError();

      const next = new Map<string, string>();
      for (const row of data ?? []) {
        if (row.contact_id && !next.has(row.contact_id)) {
          next.set(row.contact_id, row.starts_at);
        }
      }
      return next;
    },
    enabled: enabled && !!userId && !!orgId,
  });
}

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
    onSuccess: (data) => invalidateAppointments(queryClient, orgId, data),
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
    onSuccess: (data) => invalidateAppointments(queryClient, orgId, data),
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
      calendar_id: string;
      contact_id?: string | null;
    }) => {
      if (!orgId) throw new Error("No active organization");

      await supabase
        .from("appointments")
        .delete()
        .eq("id", id)
        .eq("organization_id", orgId)
        .throwOnError();
    },
    onSuccess: (_data, { contact_id }) =>
      invalidateAppointments(queryClient, orgId, { contact_id }),
  });
}
