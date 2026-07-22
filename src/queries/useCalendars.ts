import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type Database, supabase } from "@/supabase/client";
import useBoundStore from "@/stores/useBoundStore";
import { queryKeys } from "./queryKeys";

export type CalendarRow = Database["public"]["Tables"]["calendars"]["Row"];
export type CalendarInsert =
  Database["public"]["Tables"]["calendars"]["Insert"];
export type CalendarUpdate =
  Database["public"]["Tables"]["calendars"]["Update"];

export function useCalendars() {
  const userId = useBoundStore((state) => state.ui.user?.id);
  const orgId = useBoundStore((state) => state.ui.activeOrgId);

  return useQuery({
    queryKey: queryKeys.calendars.all(orgId),
    queryFn: async () =>
      await supabase
        .from("calendars")
        .select()
        .eq("organization_id", orgId!)
        .order("created_at", { ascending: false })
        .throwOnError(),
    enabled: !!userId && !!orgId,
    select: (data) => data.data as CalendarRow[],
  });
}

export function useCalendar(id: string) {
  const userId = useBoundStore((state) => state.ui.user?.id);
  const orgId = useBoundStore((state) => state.ui.activeOrgId);

  return useQuery({
    queryKey: queryKeys.calendars.detail(orgId, id),
    queryFn: async () =>
      await supabase
        .from("calendars")
        .select()
        .eq("id", id)
        .eq("organization_id", orgId!)
        .single()
        .throwOnError(),
    enabled: !!userId && !!orgId,
    select: (data) => data.data as CalendarRow,
    experimental_prefetchInRender: true,
  });
}

export function useCreateCalendar() {
  const queryClient = useQueryClient();
  const orgId = useBoundStore((state) => state.ui.activeOrgId);

  return useMutation({
    mutationFn: async (data: Omit<CalendarInsert, "organization_id">) => {
      if (!orgId) throw new Error("No active organization");

      const { data: calendar } = await supabase
        .from("calendars")
        .insert({ ...data, organization_id: orgId })
        .select()
        .single()
        .throwOnError();

      return calendar;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.calendars.all(orgId),
      });
      queryClient.setQueryData(
        queryKeys.calendars.detail(orgId, data.id),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (old: any) => (old ? { ...old, data } : { data, error: null }),
      );
    },
  });
}

export function useUpdateCalendar() {
  const queryClient = useQueryClient();
  const orgId = useBoundStore((state) => state.ui.activeOrgId);

  return useMutation({
    mutationFn: async ({ id, ...data }: CalendarUpdate & { id: string }) => {
      if (!orgId) throw new Error("No active organization");

      const { data: calendar } = await supabase
        .from("calendars")
        .update(data)
        .eq("id", id)
        .eq("organization_id", orgId)
        .select()
        .single()
        .throwOnError();

      return calendar;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.calendars.all(orgId),
      });
      queryClient.setQueryData(
        queryKeys.calendars.detail(orgId, data.id),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (old: any) => (old ? { ...old, data } : { data, error: null }),
      );
    },
  });
}

export function useDeleteCalendar() {
  const queryClient = useQueryClient();
  const orgId = useBoundStore((state) => state.ui.activeOrgId);

  return useMutation({
    mutationFn: async (id: string) => {
      if (!orgId) throw new Error("No active organization");

      await supabase.from("calendars").delete().eq("id", id).throwOnError();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.calendars.all(orgId),
      });
    },
  });
}
