// Mirror of public.uuid_generate_v7() in acrm-api
// (supabase/schemas/02_functions/02-00_uuid.sql). Used where a row id has to
// exist before the insert — an optimistic row pushed to the store has to carry
// the same id the server will store. Keeps those ids time-ordered like the
// column defaults, so they cluster in the primary key.
export function uuidv7(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const ms = Date.now();
  for (let i = 0; i < 6; i++) bytes[i] = (ms / 2 ** (8 * (5 - i))) & 0xff;
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const h = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(
    16,
    20,
  )}-${h.slice(20)}`;
}
