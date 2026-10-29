import { supabase } from "@/supabase/client";
import { throwFunctionError } from "@/queries/throwFunctionError";

/** Matches the API's PATIENT_DATA_URI (`_shared/media.ts`): a therapy
 *  practice's conversation files, sent or received, are kept in its country's
 *  S3 bucket and reached only through one-minute links from patient-data. */
const PATIENT_DATA_URI = "patient://";
const INTERNAL_MEDIA_URI = "internal://media/";

export async function downloadMessageMedia(
  messageId: string,
  uri: string,
): Promise<Blob> {
  if (uri.startsWith(PATIENT_DATA_URI)) {
    const link = await supabase.functions.invoke<{ url: string }>(
      "patient-data/media/download-link",
      { method: "POST", body: { messageId, uri } },
    );
    if (link.error) await throwFunctionError(link.error);

    const response = await fetch(link.data!.url);
    if (!response.ok) throw new Error(`Download failed (${response.status})`);
    return await response.blob();
  }

  const { data, error } = await supabase.storage
    .from("media")
    .download(uri.replace(INTERNAL_MEDIA_URI, ""));
  if (error) throw error;
  return data;
}

export async function uploadPatientMessageMedia(
  messageId: string,
  conversationId: string,
  blob: Blob,
): Promise<string> {
  const link = await supabase.functions.invoke<{
    uri: string;
    uploadUrl: string;
  }>("patient-data/media/upload-link", {
    method: "POST",
    body: { messageId, conversationId },
  });
  if (link.error) await throwFunctionError(link.error);

  const put = await fetch(link.data!.uploadUrl, {
    method: "PUT",
    body: blob,
    headers: blob.type ? { "Content-Type": blob.type } : undefined,
  });
  if (!put.ok) throw new Error(`Upload failed (${put.status})`);

  return link.data!.uri;
}
