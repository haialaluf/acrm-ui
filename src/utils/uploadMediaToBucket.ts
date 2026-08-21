import { supabase } from "@/supabase/client";

/** Internal storage reference prefix, matching the API's BASE_URI
 *  (`_shared/media.ts`). Nothing signs a URL at upload time any more — the
 *  dispatcher that actually sends the message resolves this to a fresh,
 *  short-lived signed URL at send time, cached per shared asset so a
 *  broadcast signs it once rather than once per recipient. */
export const MEDIA_INTERNAL_URI_PREFIX = "internal://media";

/** Guess a file extension for the stored object from the mime type, falling
 *  back to the source name's suffix. Keeps the object name tidy; the served
 *  content-type comes from the upload's `contentType`, not the extension. */
function extensionFor(mimeType: string, fallbackName?: string): string {
  const fromMime = mimeType.split("/")[1]?.split(";")[0];
  if (fromMime) return fromMime === "jpeg" ? "jpg" : fromMime;
  if (fallbackName) {
    const dot = fallbackName.lastIndexOf(".");
    if (dot >= 0) return fallbackName.slice(dot + 1);
  }
  return "bin";
}

/** Store a blob in the private `media` bucket and return an unsigned internal
 *  reference to it — not a signed URL. Whatever eventually sends this asset
 *  (whatsapp-dispatcher, email-dispatcher, instagram-dispatcher) resolves it
 *  to a real signed URL at send time.
 *
 *  Path follows the org-scoped convention required by the bucket's RLS
 *  (`storage.foldername(name)[2]` must be an authorized org id):
 *  `organizations/<orgId>/attachments/<uuid>.<ext>`. */
export async function uploadMediaToBucket(
  blob: Blob,
  orgId: string,
  fileName?: string,
): Promise<string> {
  const ext = extensionFor(blob.type, fileName);
  const path = `organizations/${orgId}/attachments/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("media")
    .upload(path, blob, {
      upsert: true,
      contentType: blob.type || undefined,
    });
  if (uploadError) {
    throw new Error(`Failed to store media: ${uploadError.message}`);
  }

  return `${MEDIA_INTERNAL_URI_PREFIX}/${path}`;
}
