import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type Database, supabase } from "@/supabase/client";
import useBoundStore from "@/stores/useBoundStore";
import type { FilePart } from "@/supabase/types/message_types";
import { mediaBucketPath } from "@/hooks/useSignedMediaUrl";
import { queryKeys } from "./queryKeys";

export type ContactFileRow =
  Database["public"]["Tables"]["contact_files"]["Row"];

export type ChatFile = {
  id: string;
  timestamp: string;
  file: FilePart["file"];
  kind: FilePart["kind"];
};

const DOWNLOAD_URL_TTL_SECONDS = 60;

export function useContactFiles(contactId: string) {
  const userId = useBoundStore((state) => state.ui.user?.id);
  const orgId = useBoundStore((state) => state.ui.activeOrgId);

  return useQuery({
    queryKey: queryKeys.contacts.files(orgId, contactId),
    queryFn: async () => {
      const { data } = await supabase
        .from("contact_files")
        .select()
        .eq("contact_id", contactId)
        .order("created_at", { ascending: false })
        .throwOnError();
      return data ?? [];
    },
    enabled: !!userId && !!orgId && !!contactId,
  });
}

/** Files the contact sent in any of their conversations. Stickers are left
 *  out: they are reactions, not documents anyone wants to file. */
export function useContactChatFiles(
  contactId: string,
  conversationIds: string[],
) {
  const userId = useBoundStore((state) => state.ui.user?.id);
  const orgId = useBoundStore((state) => state.ui.activeOrgId);

  return useQuery({
    queryKey: queryKeys.contacts.chatFiles(orgId, contactId, conversationIds),
    queryFn: async () => {
      const { data } = await supabase
        .from("messages")
        .select("id, timestamp, content")
        .in("conversation_id", conversationIds)
        .eq("direction", "incoming")
        .eq("content->>type", "file")
        .neq("content->>kind", "sticker")
        .order("timestamp", { ascending: false })
        .limit(100)
        .throwOnError();

      return (data ?? []).flatMap((row): ChatFile[] => {
        const part = row.content as unknown as FilePart;
        return part?.file?.uri
          ? [
              {
                id: row.id,
                timestamp: row.timestamp,
                file: part.file,
                kind: part.kind,
              },
            ]
          : [];
      });
    },
    enabled: !!userId && !!orgId && conversationIds.length > 0,
  });
}

export function useUploadContactFile(
  contactId: string,
  organizationId: string,
) {
  const queryClient = useQueryClient();
  const orgId = useBoundStore((state) => state.ui.activeOrgId);

  return useMutation({
    mutationFn: async (file: File) => {
      const id = crypto.randomUUID();
      const path = `organizations/${organizationId}/contact-files/${contactId}/${id}`;

      const { error } = await supabase.storage
        .from("media")
        .upload(path, file, {
          contentType: file.type || undefined,
        });
      if (error) throw error;

      await supabase
        .from("contact_files")
        .insert({
          id,
          organization_id: organizationId,
          contact_id: contactId,
          name: file.name || id,
          mime_type: file.type || null,
          size_bytes: file.size,
          storage_path: path,
        })
        .throwOnError();
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.contacts.files(orgId, contactId),
      }),
  });
}

export function useDeleteContactFile(contactId: string) {
  const queryClient = useQueryClient();
  const orgId = useBoundStore((state) => state.ui.activeOrgId);

  return useMutation({
    mutationFn: async (file: ContactFileRow) => {
      await supabase
        .from("contact_files")
        .delete()
        .eq("id", file.id)
        .throwOnError();
      await supabase.storage.from("media").remove([file.storage_path]);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.contacts.files(orgId, contactId),
      }),
  });
}

/** The tab is opened before signing because a `window.open` after an await
 *  is no longer tied to the click, and popup blockers drop it. */
export async function openStoredFile(pathOrUri: string) {
  const tab = window.open("", "_blank");
  const path = mediaBucketPath(pathOrUri) ?? pathOrUri;
  const { data, error } = await supabase.storage
    .from("media")
    .createSignedUrl(path, DOWNLOAD_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) {
    tab?.close();
    throw error ?? new Error("No signed URL");
  }
  if (tab) tab.location.href = data.signedUrl;
}
