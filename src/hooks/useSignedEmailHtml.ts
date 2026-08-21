import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/supabase/client";
import { MEDIA_INTERNAL_URI_PREFIX } from "@/utils/uploadMediaToBucket";
import { PREVIEW_SIGNED_URL_TTL_SECONDS } from "./useSignedMediaUrl";

/** Every `internal://media/...` reference in a compiled email. Mirrors the
 *  pattern email-dispatcher resolves with at send time, so the preview and the
 *  delivered message agree on what counts as a reference. */
const INTERNAL_MEDIA_URI = new RegExp(
  `${MEDIA_INTERNAL_URI_PREFIX}/[^"'\\s)]+`,
  "g",
);

/**
 * A saved email template's HTML with its storage references swapped for signed
 * URLs, so a preview renders the same images the recipient will get.
 *
 * A stored template holds unsigned `internal://media/...` references — a scheme
 * no browser can fetch, which is why an unresolved preview shows broken images.
 * The dispatcher signs them per send; this is the on-screen equivalent, and the
 * single-URL `useSignedMediaUrl` is the same idea for a template's header
 * media.
 *
 * Signs every distinct asset in one batch — an email is usually a logo plus a
 * hero, and one round trip beats one per image. HTML with no references (an
 * older template, or one using externally hosted images) is passed straight
 * back without a query.
 */
export function useSignedEmailHtml(html?: string): string {
  const uris = useMemo(
    () => [...new Set(html?.match(INTERNAL_MEDIA_URI) ?? [])].sort(),
    [html],
  );

  // The query resolves *assets*, not this particular HTML: two templates
  // sharing a logo should share one signature, and editing the copy around an
  // image must not re-sign it. Substitution then happens below, against
  // whichever HTML the caller currently holds.
  const { data: signedByUri } = useQuery({
    queryKey: ["signed-email-media", uris],
    queryFn: async () => {
      const paths = uris.map((uri) =>
        decodeURIComponent(uri.slice(MEDIA_INTERNAL_URI_PREFIX.length + 1))
      );

      const { data, error } = await supabase.storage
        .from("media")
        .createSignedUrls(paths, PREVIEW_SIGNED_URL_TTL_SECONDS);
      if (error) throw error;

      const signedByPath = new Map(
        (data ?? [])
          .filter((row) => row.signedUrl)
          .map((row) => [row.path, row.signedUrl]),
      );

      // An object that failed to sign is simply absent, keeping its internal
      // reference below — one dead image should not blank the whole preview.
      return new Map(
        uris.flatMap((uri, i) => {
          const signedUrl = signedByPath.get(paths[i]);
          return signedUrl ? [[uri, signedUrl] as const] : [];
        }),
      );
    },
    enabled: uris.length > 0,
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  });

  return useMemo(() => {
    // Until the signatures land, the raw HTML is the better placeholder: the
    // layout and copy render, only the images are momentarily missing.
    if (!html || !signedByUri?.size) return html ?? "";

    let out = html;
    for (const [uri, signedUrl] of signedByUri) {
      out = out.split(uri).join(signedUrl);
    }
    return out;
  }, [html, signedByUri]);
}
