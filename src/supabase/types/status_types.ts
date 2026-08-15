//===================================
// Ported from open-bsp-api/.../_shared/types/status_types.ts
// Only the stored status shapes are needed UI-side (no webhook/endpoint status).
//===================================

import type { WebhookError } from "./whatsapp_webhook_payload_types";

export type IncomingStatus = {
  pending?: string; // new Date().toISOString()
  read?: string;
  typing?: string;
  edited?: string; // sender edited the message (Instagram, WhatsApp coexistence)
  deleted?: string; // sender deleted/revoked the message (Instagram, WhatsApp coexistence)
  preprocessing?: string;
  preprocessed?: string;
};

export type OutgoingStatus = {
  pending?: string; // new Date().toISOString()
  held_for_quality_assessment?: string;
  accepted?: string;
  sent?: string;
  delivered?: string;
  read?: string;
  played?: string; // recipient listened to a voice note
  edited?: string; // sender edited the message (Instagram, WhatsApp coexistence)
  deleted?: string; // sender deleted/revoked the message (Instagram, WhatsApp coexistence)
  failed?: string;
  preprocessing?: string;
  preprocessed?: string;
  errors?: WebhookError[];
  /**
   * The raw WAMID this message was announced under, kept verbatim.
   *
   * `external_id` holds the bare message id instead — the half both addressing
   * forms agree on (see utils/wamid.ts). But the reaction endpoint addresses a
   * message by full WAMID, so reacting to something we sent needs the form
   * `external_id` drops. Absent on anything sent before the API started
   * keeping it; Meta says it once and never again, so it cannot be backfilled.
   */
  wamid?: string;
};
