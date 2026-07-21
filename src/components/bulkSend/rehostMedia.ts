import { uploadMediaToBucket } from "@/utils/uploadMediaToBucket";

/** Re-host a template's example header media (a Meta `header_handle` URL on
 *  `scontent.whatsapp.net`) into our own storage and return a public,
 *  Meta-fetchable link.
 *
 *  The raw handle cannot be used as a send-time header `link`: Meta's delivery
 *  fetcher gets 403 Forbidden from it (error 131053, "Media upload error").
 *  The bytes are downloadable though, so we copy them into the private `media`
 *  bucket and return a time-limited signed URL that Meta *can* fetch. */
export async function rehostTemplateExample(
  exampleUrl: string,
  orgId: string,
): Promise<string> {
  const res = await fetch(exampleUrl);
  if (!res.ok) {
    throw new Error(`Failed to download example media (HTTP ${res.status})`);
  }
  const blob = await res.blob();
  return uploadMediaToBucket(blob, orgId, new URL(exampleUrl).pathname);
}
