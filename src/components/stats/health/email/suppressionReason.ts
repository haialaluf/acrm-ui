import type { SuppressedAddressRow } from "@/queries/useEmailHealth";
import type { Tone } from "../primitives";

/**
 * Why an address may no longer be emailed.
 *
 * Three different SQL functions write `contacts_addresses.extra.opt_out`, each
 * with its own `source`, and the distinction matters to the person reading the
 * list: an unsubscribe is the system working as intended, a hard bounce is a
 * bad address, and a spam complaint is the one that endangers the whole
 * account's ability to send.
 */
export type SuppressionKind =
  | "unsubscribed"
  | "hard_bounce"
  | "complaint"
  | "other";

export type SuppressionReason = {
  kind: SuppressionKind;
  /** Untranslated label — callers pass it through `t`. */
  label: string;
  tone: Tone;
  /** The raw `reason` string, e.g. `hard_bounce:General`. */
  detail: string | null;
  at: string | null;
};

const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);

const str = (v: unknown): string | null => (typeof v === "string" ? v : null);

export function suppressionReason(
  row: Pick<SuppressedAddressRow, "extra" | "updated_at">,
): SuppressionReason {
  const extra = isRecord(row.extra) ? row.extra : {};
  const optOut = isRecord(extra.opt_out) ? extra.opt_out : {};

  const source = str(optOut.source);
  const reason = str(optOut.reason);
  // `apply_unsubscribe` stamps no `reason`, so fall back to the row's own
  // timestamp rather than showing nothing.
  const at = str(optOut.at) ?? row.updated_at;

  if (source === "unsubscribe_link") {
    return {
      kind: "unsubscribed",
      label: "Unsubscribed",
      tone: "neutral",
      detail: null,
      at,
    };
  }

  if (source === "ses_feedback") {
    if (reason?.startsWith("complaint")) {
      return {
        kind: "complaint",
        label: "Reported as spam",
        tone: "destructive",
        detail: reason,
        at,
      };
    }

    if (reason?.startsWith("hard_bounce")) {
      return {
        kind: "hard_bounce",
        label: "Address does not exist",
        tone: "warning",
        detail: reason,
        at,
      };
    }
  }

  // Everything else, including the WhatsApp keyword handler's opt-outs, which
  // share this table.
  return {
    kind: "other",
    label: "Removed",
    tone: "neutral",
    detail: reason,
    at,
  };
}
