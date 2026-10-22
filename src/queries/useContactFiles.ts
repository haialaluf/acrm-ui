import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type Database, supabase } from "@/supabase/client";
import useBoundStore from "@/stores/useBoundStore";
import type { FilePart } from "@/supabase/types/message_types";
import { mediaBucketPath } from "@/hooks/useSignedMediaUrl";
import { queryKeys } from "./queryKeys";
import { throwFunctionError } from "./throwFunctionError";

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
    refetchInterval: (query) =>
      query.state.data?.some((f) => f.text_status === "reading") ? 5000 : false,
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

/** Patient files go to the practice's S3 bucket for its data region: the
 *  patient-data function hands out a one-minute upload link, the browser PUTs
 *  the file straight to S3, then the function records it. */
export function useUploadContactFile(contactId: string) {
  const queryClient = useQueryClient();
  const orgId = useBoundStore((state) => state.ui.activeOrgId);

  return useMutation({
    mutationFn: async (file: File) => {
      const link = await supabase.functions.invoke<{
        fileId: string;
        uploadUrl: string;
      }>("patient-data/files/upload-link", {
        method: "POST",
        body: { contactId },
      });
      if (link.error) await throwFunctionError(link.error);

      const put = await fetch(link.data!.uploadUrl, {
        method: "PUT",
        body: file,
        headers: file.type ? { "Content-Type": file.type } : undefined,
      });
      if (!put.ok) throw new Error(`Upload failed (${put.status})`);

      const done = await supabase.functions.invoke(
        "patient-data/files/complete",
        {
          method: "POST",
          body: {
            fileId: link.data!.fileId,
            contactId,
            name: file.name,
            mimeType: file.type || null,
          },
        },
      );
      if (done.error) await throwFunctionError(done.error);
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
      if (file.storage === "s3") {
        const { error } = await supabase.functions.invoke(
          `patient-data/files/${file.id}`,
          { method: "DELETE" },
        );
        if (error) await throwFunctionError(error);
        return;
      }
      await supabase
        .from("contact_files")
        .delete()
        .eq("id", file.id)
        .throwOnError();
      await supabase.storage
        .from("media")
        .remove([file.storage_path, `${file.storage_path}_text`]);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.contacts.files(orgId, contactId),
      }),
  });
}

async function signedUrl(location: StoredFile): Promise<string> {
  if (location.storage === "s3") {
    const { data, error } = await supabase.functions.invoke<{ url: string }>(
      `patient-data/files/${location.fileId}/download-link`,
      { method: "POST" },
    );
    if (error) await throwFunctionError(error);
    return data!.url;
  }
  const path = mediaBucketPath(location.path) ?? location.path;
  const { data, error } = await supabase.storage
    .from("media")
    .createSignedUrl(path, DOWNLOAD_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) throw error ?? new Error("No signed URL");
  return data.signedUrl;
}

export type StoredFile =
  | { storage: "s3"; fileId: string }
  | { storage: "media"; path: string };

/** The tab is opened before signing because a `window.open` after an await
 *  is no longer tied to the click, and popup blockers drop it. */
export async function openStoredFile(location: StoredFile) {
  const tab = window.open("", "_blank");
  try {
    const url = await signedUrl(location);
    if (tab) tab.location.href = url;
  } catch (err) {
    tab?.close();
    throw err;
  }
}
