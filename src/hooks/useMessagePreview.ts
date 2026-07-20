import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { MessagePreviewData } from "@/components/messagePreview/types";

// The live message preview is shared through the React Query cache: the editor
// writes with setQueryData, the preview reads with useQuery. Same cache, no
// common parent — so the form (Left Panel) and the preview (Center Panel on
// desktop) stay decoupled. The query never fetches; it's pure client state.
const MESSAGE_PREVIEW_KEY = ["messagePreview"] as const;

/** Read the live message-preview payload (re-renders on every update). */
export function useMessagePreview() {
  return useQuery<MessagePreviewData | null>({
    queryKey: MESSAGE_PREVIEW_KEY,
    queryFn: () => null,
    initialData: null,
    staleTime: Infinity,
    gcTime: Infinity,
  }).data;
}

/** Stable setter to push the live message-preview payload from the editor. */
export function useSetMessagePreview() {
  const queryClient = useQueryClient();
  return useCallback(
    (data: MessagePreviewData | null) =>
      queryClient.setQueryData(MESSAGE_PREVIEW_KEY, data),
    [queryClient],
  );
}
