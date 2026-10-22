import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/supabase/client";
import useBoundStore from "@/stores/useBoundStore";
import type { ChatStore } from "@/components/therapy/AiChat";
import {
  type ChatThread,
  patientChatScope,
} from "@/components/therapy/therapyStore";
import { queryKeys } from "./queryKeys";
import { throwFunctionError } from "./throwFunctionError";

type StoredChat = {
  id: string;
  title: string;
  messages: ChatThread["messages"];
  attachments: string[];
  created_at: string;
  updated_at: string;
};

const byNewest = (a: ChatThread, b: ChatThread) =>
  b.updatedAt.localeCompare(a.updatedAt);

/** The signed-in therapist's patient Ask AI chats about one patient, kept in
 *  the clinic's patient-data bucket so they follow the therapist to any
 *  computer. Saves show at once and are sent in the background. */
export function usePatientChats(contactId: string): ChatStore {
  const orgId = useBoundStore((state) => state.ui.activeOrgId);
  const queryClient = useQueryClient();
  const key = queryKeys.contacts.askChats(orgId, contactId);
  const scope = patientChatScope(contactId);

  const { data, isSuccess, isError, refetch } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const result = await supabase.functions.invoke<{
        chats: StoredChat[];
      }>(`patient-data/chats/${contactId}`, { method: "GET" });
      if (result.error) await throwFunctionError(result.error);
      return (result.data?.chats ?? [])
        .map(
          (c): ChatThread => ({
            id: c.id,
            scope,
            title: c.title,
            attachments: c.attachments,
            messages: c.messages,
            updatedAt: c.updated_at,
          }),
        )
        .sort(byNewest);
    },
    enabled: !!orgId,
  });

  const put = (update: (chats: ChatThread[]) => ChatThread[]) =>
    queryClient.setQueryData<ChatThread[]>(key, (chats) =>
      update(chats ?? []).sort(byNewest),
    );
  const resync = () => void queryClient.invalidateQueries({ queryKey: key });

  return {
    chats: data ?? [],
    loaded: isSuccess,
    failed: isError,
    retry: () => void refetch(),
    saveChat: (chat) => {
      put((chats) => [chat, ...chats.filter((c) => c.id !== chat.id)]);
      void supabase.functions
        .invoke<unknown>(`patient-data/chats/${chat.id}`, {
          method: "PUT",
          body: {
            contactId,
            title: chat.title,
            messages: chat.messages,
            attachments: chat.attachments,
          },
        })
        .then((result) => {
          if (result.error) resync();
        });
    },
    deleteChat: (id) => {
      put((chats) => chats.filter((c) => c.id !== id));
      void supabase.functions
        .invoke<unknown>(`patient-data/chats/${id}`, { method: "DELETE" })
        .then((result) => {
          if (result.error) resync();
        });
    },
  };
}
