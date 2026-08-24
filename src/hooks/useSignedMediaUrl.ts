import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/supabase/client";
import { MEDIA_INTERNAL_URI_PREFIX } from "@/utils/uploadMediaToBucket";

/** How long a re-signed preview URL stays valid. Not the send-time TTL (the
 *  API owns that, per channel, via getOrCreateSignedUrl) — this is purely
 *  for rendering something on screen right now. */
export const PREVIEW_SIGNED_URL_TTL_SECONDS = 60 * 60;

/** Object path inside our private `media` bucket, as it appears in a storage
 *  URL: `…/storage/v1/object/sign/media/<path>?token=…`. */
const MEDIA_OBJECT_URL =
  /\/storage\/v1\/object\/(?:sign|public)\/media\/([^?]+)/;

/** Matches the API's unsigned internal storage reference
 *  (`internal://media/<path>`), used everywhere a signed URL used to be
 *  stored before send-time signing. */
const INTERNAL_MEDIA_URI = new RegExp(`^${MEDIA_INTERNAL_URI_PREFIX}/(.+)$`);

/** The `media` bucket object a storage URL (or internal reference) points
 *  at, or `null` for a URL that is not ours (an externally hosted file). */
export function mediaBucketPath(url: string): string | null {
  const internalMatch = INTERNAL_MEDIA_URI.exec(url);
  if (internalMatch) return decodeURIComponent(internalMatch[1]);

  const match = MEDIA_OBJECT_URL.exec(url);
  return match ? decodeURIComponent(match[1]) : null;
}

/** A currently-valid URL for a file we uploaded to the `media` bucket.
 *
 *  Links stored inside a message (e.g. a template's header media) are signed
 *  with a finite TTL — long enough for Meta to fetch the file at delivery time,
 *  but not for the conversation history, which is read months later. Rather
 *  than serve a dead link, re-sign the same object on demand. URLs from outside
 *  our bucket are returned untouched, since there is nothing to re-sign.
 *
 *  Returns `undefined` while a signature is in flight. Cached well inside the
 *  signature's lifetime so a virtualized chat row can mount repeatedly without
 *  re-signing. */
export function useSignedMediaUrl(url?: string): string | undefined {
  const path = url ? mediaBucketPath(url) : null;

  const { data } = useQuery({
    queryKey: ["signed-media-url", path, url],
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from("media")
        .createSignedUrl(path!, PREVIEW_SIGNED_URL_TTL_SECONDS);
      // A failed signature is not worth surfacing: the stored link may well
      // still be within its own TTL, so let the browser try it.
      return error || !data?.signedUrl ? url! : data.signedUrl;
    },
    enabled: !!path,
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  });

  return path ? data : url;
}
