import { supabase } from "@/supabase/client";

/** Signed-URL lifetime for a re-hosted template header (7 days). Meta fetches
 *  header media at delivery time, so this only needs to outlive the broadcast;
 *  a week gives a generous margin for scheduled/large sends. */
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7;

/** Guess a file extension for the stored object from the mime type, falling
 *  back to the source URL's path. Keeps the object name tidy; the served
 *  content-type comes from `contentType` below, not the extension. */
function extensionFor(mimeType: string, sourceUrl: string): string {
  const fromMime = mimeType.split("/")[1]?.split(";")[0];
  if (fromMime) return fromMime === "jpeg" ? "jpg" : fromMime;
  const path = new URL(sourceUrl).pathname;
  const dot = path.lastIndexOf(".");
  return dot >= 0 ? path.slice(dot + 1) : "bin";
}

/** Re-host a template's example header media (a Meta `header_handle` URL on
 *  `scontent.whatsapp.net`) into our own storage and return a public,
 *  Meta-fetchable link.
 *
 *  The raw handle cannot be used as a send-time header `link`: Meta's delivery
 *  fetcher gets 403 Forbidden from it (error 131053, "Media upload error").
 *  The bytes are downloadable though, so we copy them into the private `media`
 *  bucket and return a time-limited signed URL that Meta *can* fetch without
 *  exposing the bucket publicly.
 *
 *  Path follows the org-scoped convention required by the bucket's RLS
 *  (`storage.foldername(name)[2]` must be an authorized org id):
 *  `organizations/<orgId>/attachments/<uuid>.<ext>`. */
export async function rehostTemplateExample(
  exampleUrl: string,
  orgId: string,
): Promise<string> {
  const res = await fetch(exampleUrl);
  if (!res.ok) {
    throw new Error(`Failed to download example media (HTTP ${res.status})`);
  }
  const blob = await res.blob();

  const ext = extensionFor(blob.type, exampleUrl);
  const path =
    `organizations/${orgId}/attachments/${crypto.randomUUID()}.${ext}`;

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
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (signError || !data?.signedUrl) {
    throw new Error(
      `Failed to sign media URL: ${signError?.message ?? "unknown error"}`,
    );
  }

  return data.signedUrl;
}
