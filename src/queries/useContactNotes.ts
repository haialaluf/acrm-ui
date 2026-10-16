import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/supabase/client";
import useBoundStore from "@/stores/useBoundStore";
import { useCurrentOrganization } from "./useOrganizations";
import { queryKeys } from "./queryKeys";
import { throwFunctionError } from "./throwFunctionError";

const NOTE_SELECT = "*, agent:agents(name, ai)";

async function fetchNotes(contactId: string) {
  const { data } = await supabase
    .from("contact_notes")
    .select(NOTE_SELECT)
    .eq("contact_id", contactId)
    .order("created_at", { ascending: false })
    .throwOnError();
  return data;
}

type Note = Awaited<ReturnType<typeof fetchNotes>>[number];

/** A therapy practice's note text is kept in its patient-data bucket, so its
 *  notes are read and written only through the patient-data function. */
function useIsTherapy() {
  const { data: org } = useCurrentOrganization();
  return org?.extra?.workspace_type === "therapy";
}

async function invokePatientData<T>(
  path: string,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  body?: Record<string, unknown>,
): Promise<T> {
  const result = await supabase.functions.invoke<T>(`patient-data/${path}`, {
    method,
    body,
  });
  if (result.error) await throwFunctionError(result.error);
  return result.data as T;
}

export async function addTherapyNote(contactId: string, body: string) {
  await invokePatientData("notes", "POST", { contactId, body });
}

/** A contact's notes, newest first, each with the agent or person who wrote it. */
export function useContactNotes(contactId: string) {
  const userId = useBoundStore((state) => state.ui.user?.id);
  const orgId = useBoundStore((state) => state.ui.activeOrgId);
  const isTherapy = useIsTherapy();

  return useQuery({
    queryKey: [...queryKeys.contacts.notes(orgId, contactId), isTherapy],
    queryFn: async () => {
      const notes = isTherapy
        ? await invokePatientData<Note[]>(`notes/${contactId}`, "GET")
        : await fetchNotes(contactId);
      return notes.map((note) => ({ ...note, body: note.body ?? "" }));
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
  const isTherapy = useIsTherapy();

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
      if (isTherapy) return await addTherapyNote(contactId, body);

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
  const isTherapy = useIsTherapy();

  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: string }) => {
      if (isTherapy) {
        return void (await invokePatientData(`notes/${id}`, "PATCH", { body }));
      }

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
  const isTherapy = useIsTherapy();

  return useMutation({
    mutationFn: async (id: string) => {
      if (isTherapy) {
        return void (await invokePatientData(`notes/${id}`, "DELETE"));
      }

      await supabase.from("contact_notes").delete().eq("id", id).throwOnError();
    },
    onSuccess: invalidate,
  });
}
