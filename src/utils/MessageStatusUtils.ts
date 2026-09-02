import { type OutgoingStatus } from "@/supabase/client";
// @ts-expect-error no type declarations for the core-js-pure submodule
import toReversed from "core-js-pure/actual/array/to-reversed";

const outgoingStatusHierarchy = [
  "pending",
  "held_for_quality_assessment",
  "accepted",
  "sent",
  "delivered",
  // `played` outranks `read`: Meta sends it for a voice note the recipient
  // listened to, and does not repeat the `read` that implies. Without it here a
  // played-only voice note matched no level and fell through to `pending`,
  // rendering a clock on a message that had demonstrably been heard.
  "read",
  "played",
  "failed",
] as const;

/**
 * Statuses that only Meta can tell us, so their presence proves a receipt for
 * this message actually arrived. `sent` is deliberately not one of them: the
 * echo path writes it from the webhook timestamp without any receipt involved.
 */
const RECEIPT_STATUSES = ["delivered", "read", "played", "failed"] as const;

/**
 * Whether a message was sent from the WhatsApp Business app rather than through
 * the CRM, and so can never be marked delivered or read.
 *
 * Meta does not send status webhooks for messages a business sends from the
 * WhatsApp Business app under coexistence — the documented `smb_message_echoes`
 * payload carries no `statuses` array, and the status webhook's triggers cover
 * only messages the API sent. The echo is therefore written once with `sent`
 * (whatsapp-webhook/index.ts) and nothing ever updates it, which used to leave
 * these messages on a single grey tick forever while the business's own phone
 * showed two blue ones.
 *
 * The tell is the absent `pending`: every message the CRM dispatches is born
 * with it (the `status` column default) and keeps it, because the `set_status`
 * trigger merges status keys rather than replacing them. Only the two
 * app-origin paths omit it.
 *
 * Messages recovered by history sync are excluded: those carry a real
 * `history_context.status`, so they get rendered on their actual receipt.
 *
 * `sent` is required rather than merely assumed from the absent `pending`, so
 * the two shapes that are not app-sent-and-unreported keep their old icon: a
 * history row synced while still PENDING (`{accepted}`) stays on one tick
 * because it had not left the phone, and an empty status stays on the clock.
 */
export function isAppSentWithoutReceipts(status: OutgoingStatus): boolean {
  if (!status || "pending" in status || !("sent" in status)) return false;

  return !RECEIPT_STATUSES.some((level) => level in status);
}

/** Tooltip for the tick on an app-sent message. Translated at the call site. */
export const APP_SENT_TOOLTIP =
  "Sent from the WhatsApp app — Meta doesn't report delivery receipts for these";

/**
 * From a status object determine based on the hierarchy created by the objects
 * above which his the highest status that the object has in it.
 * @param status
 * @returns
 */
export function getHighestStatus(
  status: OutgoingStatus,
): (typeof outgoingStatusHierarchy)[number] {
  if (!status) {
    return "pending";
  }

  for (const level of toReversed(outgoingStatusHierarchy)) {
    if (level in status) {
      return level;
    }
  }

  return "pending";
}

/**
 * For a given status string return the corresponding icon and color to be applied
 * @param status
 * @returns { icon: string, color: string }
 */
export function getStatusIcon(
  status: (typeof outgoingStatusHierarchy)[number],
): {
  icon: string;
  color: string;
} {
  switch (status) {
    case "pending":
    case "held_for_quality_assessment":
      return {
        icon: "clock",
        color: "",
      };
    case "accepted":
    case "sent":
      return {
        icon: "check",
        color: "",
      };
    case "delivered":
      return {
        icon: "double-check",
        color: "",
      };
    case "read":
    case "played":
      return {
        icon: "double-check",
        color: "text-primary",
      };
    case "failed":
      return {
        icon: "x",
        color: "text-destructive",
      };
    default:
      return { icon: "", color: "" };
  }
}

/**
 * The icon, colour and tooltip to render for one outgoing message's status.
 *
 * Both renderers — the message bubble (Message/StatusIcon) and the chat list
 * preview (ChatListItem) — go through here so the app-sent case is decided once
 * rather than duplicated with two chances to drift.
 *
 * App-sent messages get the grey double tick, never the blue one: they really
 * did reach WhatsApp, but we have no receipt and must not claim `read`.
 */
export function getStatusPresentation(status: OutgoingStatus): {
  icon: string;
  color: string;
  title?: string;
} {
  if (isAppSentWithoutReceipts(status)) {
    return { icon: "double-check", color: "", title: APP_SENT_TOOLTIP };
  }

  return getStatusIcon(getHighestStatus(status));
}
