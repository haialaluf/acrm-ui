import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/supabase/client";
import useBoundStore from "@/stores/useBoundStore";
import { MEDIA_SIGNED_URL_TTL_SECONDS } from "@/utils/uploadMediaToBucket";
import { queryKeys } from "./queryKeys";

/** Everything we upload lands here — see `uploadMediaToBucket`. The bucket's
 *  RLS keys off `organizations/<orgId>/…`, so this prefix is also the boundary
 *  of what the current member is allowed to see. */
const folderFor = (orgId: string) => `organizations/${orgId}/attachments`;

/** Storage lists one page at a time; walk them so a workspace with hundreds of
 *  files still shows its older files, and stop at a size no picker needs to
 *  scroll past. */
const PAGE_SIZE = 100;
const MAX_OBJECTS = 1000;

export type OrgMediaItem = {
  /** Object path inside the `media` bucket. Stable — the signed URL is not. */
  path: string;
  name: string;
  /** Signed URL, valid for `MEDIA_SIGNED_URL_TTL_SECONDS`. */
  url: string;
  mimeType: string;
  size: number;
  createdAt: string | null;
};

/**
 * Every file in the org's `media` bucket, newest first, each with a fresh
 * signed URL.
 *
 * The bucket is private, so a listing on its own is unusable — a name without a
 * signature renders nothing. Both halves therefore belong together: one `list`
 * walk for the names, one `createSignedUrls` batch for the URLs, so a hundred
 * thumbnails cost two round trips rather than a hundred and one.
 *
 * `mimePrefix` filters *before* signing (pass `"image/"` for a picker that only
 * places images), which keeps us from minting signatures for the audio and PDF
 * attachments that WhatsApp conversations drop into the same bucket.
 *
 * Cached well inside the signature TTL — re-signing on every mount would defeat
 * the batching above.
 */
export function useOrgMedia({ mimePrefix }: { mimePrefix?: string } = {}) {
  const orgId = useBoundStore((state) => state.ui.activeOrgId);

  return useQuery({
    queryKey: queryKeys.media.all(orgId, mimePrefix),
    queryFn: async (): Promise<OrgMediaItem[]> => {
      const folder = folderFor(orgId!);
      const bucket = supabase.storage.from("media");
      const objects: {
        name: string;
        mimeType: string;
        size: number;
        createdAt: string | null;
      }[] = [];

      for (let offset = 0; offset < MAX_OBJECTS; offset += PAGE_SIZE) {
        const { data, error } = await bucket.list(folder, {
          limit: PAGE_SIZE,
          offset,
          sortBy: { column: "created_at", order: "desc" },
        });
        if (error) throw new Error(`Failed to list media: ${error.message}`);
        if (!data?.length) break;

        for (const object of data) {
          // Folders come back as rows with no id and no metadata; the bucket is
          // flat under `attachments`, but skipping them costs nothing.
          if (!object.id) continue;

          const mimeType = (object.metadata?.mimetype as string) ?? "";
          if (mimePrefix && !mimeType.startsWith(mimePrefix)) continue;

          objects.push({
            name: object.name,
            mimeType,
            size: (object.metadata?.size as number) ?? 0,
            createdAt: object.created_at ?? null,
          });
        }

        if (data.length < PAGE_SIZE) break;
      }

      if (!objects.length) return [];

      const { data: signed, error: signError } = await bucket.createSignedUrls(
        objects.map((object) => `${folder}/${object.name}`),
        MEDIA_SIGNED_URL_TTL_SECONDS,
      );
      if (signError) {
        throw new Error(`Failed to sign media URLs: ${signError.message}`);
      }

      // One dead object should not blank the whole panel, so drop the ones that
      // failed to sign and show the rest.
      const urlByPath = new Map(
        (signed ?? [])
          .filter((row) => row.signedUrl)
          .map((row) => [row.path, row.signedUrl]),
      );

      return objects.flatMap((object) => {
        const path = `${folder}/${object.name}`;
        const url = urlByPath.get(path);
        return url ? [{ ...object, path, url }] : [];
      });
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  });
}
