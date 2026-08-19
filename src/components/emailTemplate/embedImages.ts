import { uploadMediaToBucket } from "@/utils/uploadMediaToBucket";

/** Read a blob as a `data:` URI — usable as an `<img src>` with no network
 *  round-trip, no signing, and no expiry. This is what the email builder's
 *  document (`project`) holds for every image: self-contained, so reopening
 *  an old template for editing always just renders and nothing needs
 *  re-signing on load. Storage only enters the picture once, at save time —
 *  see `uploadEmbeddedImages`. */
export function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () =>
      reject(reader.error ?? new Error("Failed to read the image"));
    reader.readAsDataURL(blob);
  });
}

const DATA_URI_PATTERN = /data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+/g;

/**
 * Swap every embedded `data:` image in a compiled email's HTML for a
 * storage-backed internal reference, uploading each distinct image once
 * (`Set` dedups a logo reused several times in the same design).
 *
 * Called only when actually persisting the template — `project` (the editing
 * document) keeps its `data:` URIs forever, so the canvas never needs to
 * re-sign anything. Only the compiled `html` (the artifact that actually gets
 * sent) needs to reference storage, so email-dispatcher can resolve it to a
 * fresh signed URL at send time instead of the builder baking in a long-lived
 * one at authoring time.
 */
export async function uploadEmbeddedImages(
  html: string,
  orgId: string,
): Promise<string> {
  const dataUris = [...new Set(html.match(DATA_URI_PATTERN) ?? [])];
  if (dataUris.length === 0) return html;

  const replacements = await Promise.all(
    dataUris.map(async (dataUri) => {
      const blob = await (await fetch(dataUri)).blob();
      const uri = await uploadMediaToBucket(blob, orgId);
      return [dataUri, uri] as const;
    }),
  );

  let out = html;
  for (const [dataUri, uri] of replacements) {
    out = out.split(dataUri).join(uri);
  }
  return out;
}
