import { knownErrorMeta } from "@/components/stats/health/errorCodes";
import type { Json, OutgoingStatus } from "@/supabase/client";

export type FailureReason = {
  /** Provider code, when the entry carries one — Meta's number, SES's bounce
   *  sub-type. Render it LTR: it is an identifier, not prose. */
  code?: string;
  /** What happened. */
  title: string;
  /** What to do about it. Absent when all we have is the provider's own words. */
  hint?: string;
};

/**
 * `status.errors` has no single shape, because five producers write it:
 *
 *   - whatsapp-webhook stores Meta's own `WebhookError`;
 *   - the WhatsApp and Instagram dispatchers store the Graph API's
 *     `{ error: { … } }` envelope verbatim, or a bare message string when the
 *     throw was not a `WhatsAppError`;
 *   - email-dispatcher does the same with SES;
 *   - email-webhook and the blocked-recipient paths store `{ reason, … }` tags
 *     of their own invention.
 *
 * All of them have to render, so every read below is defensive.
 */
type Entry = Record<string, unknown>;

function asRecord(value: unknown): Entry | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Entry)
    : null;
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/** Copy for the `{ reason }` tags our own edge functions write. */
const REASON_TAGS: Record<string, FailureReason> = {
  suppressed: {
    title: "Not sent — the address is on your do-not-contact list",
    hint: "It bounced, reported spam or opted out before. Take it off the list to reach it again.",
  },
  complaint: {
    title: "The recipient reported this as spam",
    hint: "The address was added to your do-not-contact list. Amazon SES begins reviewing an account at a 0.1% complaint rate, so a single one matters.",
  },
  rejected: {
    title: "Amazon SES refused to send this email",
    hint: "SES rejected the message outright, usually for a virus or a malformed payload.",
  },
  rendering_failure: {
    title: "The email could not be built from the template",
    hint: "A variable was missing or malformed, so nothing was ever sent. Check the template's variables.",
  },
  delivery_delay: {
    title: "The receiving server is not accepting the email yet",
    hint: "Amazon SES is still retrying — this is not a final failure.",
  },
};

const BOUNCE_TYPES: Record<string, FailureReason> = {
  Permanent: {
    title: "The address does not exist",
    hint: "A hard bounce. The address is now on your do-not-contact list — clean it out of your lists too.",
  },
  Transient: {
    title: "The mailbox could not accept the email",
    hint: "A soft bounce — a full mailbox, or a server that refused this one time. The address stays on your list.",
  },
};

const UNKNOWN_BOUNCE: FailureReason = {
  title: "The email bounced",
  hint: "The receiving server rejected it without saying whether the address is permanently bad.",
};

function fromReasonTag(entry: Entry): FailureReason | null {
  const reason = text(entry.reason);
  if (!reason) return null;

  if (reason === "bounce") {
    return {
      ...(BOUNCE_TYPES[text(entry.bounce_type) ?? ""] ?? UNKNOWN_BOUNCE),
      code: text(entry.bounce_sub_type),
    };
  }

  const detail = text(entry.detail);
  const known = REASON_TAGS[reason];

  if (!known) return { title: reason, hint: detail };

  return { ...known, hint: detail ?? known.hint };
}

function fromProviderError(entry: Entry): FailureReason | null {
  const error = asRecord(entry.error) ?? entry;
  const rawCode = error.code;
  const code =
    typeof rawCode === "number" || typeof rawCode === "string"
      ? String(rawCode)
      : undefined;
  const details = text(asRecord(error.error_data)?.details);
  // Meta sends both: `title` is the short label, `message` the sentence. The
  // Graph envelope the dispatchers store has only `message`.
  const label = text(error.title);
  const message = text(error.message);
  const meta = code ? knownErrorMeta(code) : null;

  if (!meta && !details && !label && !message) return null;

  // Meta's `details` is written per message and names the actual cause, so it
  // outranks the generic hint we keep for the code.
  return {
    code,
    title: meta?.title ?? label ?? message ?? "Delivery failed",
    hint: details ?? meta?.hint ?? (label ? message : undefined),
  };
}

function describe(entry: unknown): FailureReason | null {
  const raw = text(entry);
  if (raw) return { title: raw };

  const value = asRecord(entry);
  if (!value) return null;

  return fromReasonTag(value) ?? fromProviderError(value);
}

/**
 * Why a message failed, or null when its status carries nothing usable.
 *
 * Says nothing about *whether* it failed — a transient error is recorded
 * without a `failed` key so the dispatcher keeps retrying, and a spam complaint
 * arrives on a message that was delivered. Callers decide when to show this.
 */
export function failureReason(
  status: OutgoingStatus | Json | null | undefined,
): FailureReason | null {
  const errors = asRecord(status)?.errors;
  if (!Array.isArray(errors)) return null;

  for (const entry of errors) {
    const described = describe(entry);
    if (described) return described;
  }

  return null;
}
