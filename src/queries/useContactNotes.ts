import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/supabase/client";
import useBoundStore from "@/stores/useBoundStore";
import { queryKeys } from "./queryKeys";

/** A contact's notes, newest first, each with the agent or person who wrote it. */
export function useContactNotes(contactId: string) {
  const userId = useBoundStore((state) => state.ui.user?.id);
  const orgId = useBoundStore((state) => state.ui.activeOrgId);

  return useQuery({
    queryKey: queryKeys.contacts.notes(orgId, contactId),
    queryFn: async () => {
      const { data } = await supabase
        .from("contact_notes")
        .select("*, agent:agents(name, ai)")
        .eq("contact_id", contactId)
        .order("created_at", { ascending: false })
        .throwOnError();

      return data;
    },
    enabled: !!userId && !!orgId && !!contactId,
  });
}

export type ContactNote = NonNullable<
  ReturnType<typeof useContactNotes>["data"]
>[number];

function useInvalidateNotes(contactId: string) {
  const queryClient = useQueryClient();
  const orgId = useBoundStore((state) => state.ui.activeOrgId);

  return () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.contacts.notes(orgId, contactId),
    });
}

export function useAddContactNote(contactId: string) {
  const invalidate = useInvalidateNotes(contactId);

  return useMutation({
    mutationFn: async ({
      organizationId,
      agentId,
      body,
    }: {
      /** The contact's own org, which is not always the active one. */
      organizationId: string;
      agentId: string | null;
      body: string;
    }) => {
      await supabase
        .from("contact_notes")
        .insert({
          organization_id: organizationId,
          contact_id: contactId,
          author_type: "user",
          agent_id: agentId,
          body,
        })
        .throwOnError();
    },
    onSuccess: invalidate,
  });
}

export function useEditContactNote(contactId: string) {
  const invalidate = useInvalidateNotes(contactId);

  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: string }) => {
      await supabase
        .from("contact_notes")
        .update({ body })
        .eq("id", id)
        .throwOnError();
    },
    onSuccess: invalidate,
  });
}

export function useDeleteContactNote(contactId: string) {
  const invalidate = useInvalidateNotes(contactId);

  return useMutation({
    mutationFn: async (id: string) => {
      await supabase
        .from("contact_notes")
        .delete()
        .eq("id", id)
        .throwOnError();
    },
    onSuccess: invalidate,
  });
}
