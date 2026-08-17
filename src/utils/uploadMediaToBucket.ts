import { supabase } from "@/supabase/client";

/** Signed-URL lifetime for media uploaded to our bucket (7 days). Meta fetches
 *  header media at delivery time (broadcasts) and at template-review time
 *  (sample assets), so this only needs to outlive those; a week is a generous
 *  margin for scheduled/large sends and slow reviews. */
export const MEDIA_SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7;

/** Signed-URL lifetime for media an *automation* step points at (5 years).
 *
 *  The 7-day default above assumes the file is fetched by Meta within days of
 *  being picked, which is true of a broadcast and false of an automation: a
 *  welcome flow configured today is still sending that header image next year,
 *  and a link that expired in the meantime fails the send with Meta's opaque
 *  131053. Until the dispatcher re-signs storage paths at delivery time, the
 *  step stores a URL that outlives the flow. */
export const DURABLE_MEDIA_SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 365 * 5;

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

/** Store a blob in the private `media` bucket and return a time-limited signed
 *  URL that Meta can fetch without exposing the bucket publicly.
 *
 *  Path follows the org-scoped convention required by the bucket's RLS
 *  (`storage.foldername(name)[2]` must be an authorized org id):
 *  `organizations/<orgId>/attachments/<uuid>.<ext>`. */
export async function uploadMediaToBucket(
  blob: Blob,
  orgId: string,
  fileName?: string,
  expiresIn: number = MEDIA_SIGNED_URL_TTL_SECONDS,
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

  const { data, error: signError } = await supabase.storage
    .from("media")
    .createSignedUrl(path, expiresIn);
  if (signError || !data?.signedUrl) {
    throw new Error(
      `Failed to sign media URL: ${signError?.message ?? "unknown error"}`,
    );
  }

  return data.signedUrl;
}
