/**
 * Broadcasts have no dedicated table (see list_broadcast_batches's SQL
 * comment); a batch is identified by its campaign's `created_at` plus its
 * `scheduled_date`. Packed into one opaque route param as base64url, not
 * percent-encoding: TanStack Router encodes dynamic segment params itself
 * when building an href, so a manually percent-encoded value (colons/plus
 * signs in an ISO timestamp) gets encoded a second time on write but only
 * decoded once on read. base64url's alphabet (A-Za-z0-9-_) contains nothing
 * any layer ever percent-encodes, so that mismatch can't happen. Plain
 * string splitting (not a Date round-trip) preserves created_at's exact
 * microsecond precision, which the RPCs match on exactly.
 */
export function encodeBatchKey(createdAt: string, scheduledDate: string) {
  const raw = `${createdAt}|${scheduledDate}`;
  return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeBatchKey(
  batchKey: string,
): { createdAt: string; scheduledDate: string } {
  let b64 = batchKey.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4) b64 += "=";
  const raw = atob(b64);
  const i = raw.lastIndexOf("|");
  return {
    createdAt: raw.slice(0, i),
    scheduledDate: raw.slice(i + 1),
  };
}
