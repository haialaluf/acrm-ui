import { uploadMediaToBucket } from "@/utils/uploadMediaToBucket";
import { supabase } from "@/supabase/client";
import { throwFunctionError } from "@/queries/throwFunctionError";
import { type HeaderMediaFormat } from "./types";

/** Re-host a template's example header media (a Meta `header_handle` URL on
 *  `scontent.whatsapp.net`) into our own storage and return a public,
 *  Meta-fetchable link.
 *
 *  The raw handle cannot be used as a send-time header `link`: Meta's delivery
 *  fetcher gets 403 Forbidden from it (error 131053, "Media upload error").
 *  The bytes are downloadable though, so we copy them into the private `media`
 *  bucket and return a time-limited signed URL that Meta *can* fetch.
 *
 *  IMAGE/VIDEO handles are served with permissive CORS, so the browser can
 *  download them directly. DOCUMENT handles are served *without* an
 *  `Access-Control-Allow-Origin` header (200 OK, but the bytes are unreadable to
 *  page JS), so that one download must happen server-side — the edge function
 *  fetches and re-hosts it, sidestepping CORS. */
export async function rehostTemplateExample(
  exampleUrl: string,
  orgId: string,
  format: HeaderMediaFormat,
  /** Signed-URL lifetime, in seconds. Omitted for a send that happens now
   *  (bulk send); an automation passes a lifetime that outlives the flow. */
  expiresIn?: number,
): Promise<string> {
  if (format === "DOCUMENT") {
    const { data, error } = await supabase.functions.invoke(
      "whatsapp-management/rehost-example",
      {
        method: "POST",
        body: {
          organization_id: orgId,
          example_url: exampleUrl,
          ...(expiresIn && { expires_in: expiresIn }),
        },
      },
    );
    if (error) await throwFunctionError(error);
    const url = (data as { url?: string } | null)?.url;
    if (!url) throw new Error("No URL returned for example media");
    return url;
  }

  const res = await fetch(exampleUrl);
  if (!res.ok) {
    throw new Error(`Failed to download example media (HTTP ${res.status})`);
  }
  const blob = await res.blob();
  return uploadMediaToBucket(
    blob,
    orgId,
    new URL(exampleUrl).pathname,
    expiresIn,
  );
}
