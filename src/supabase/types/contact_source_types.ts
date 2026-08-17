// @ui-divergence: extensionless import (the API uses "../db_types.ts").
import type { Database } from "../db_types";

type Service = Database["public"]["Enums"]["service"];

/**
 * `contacts.source` — how a contact first reached the CRM.
 *
 * The column is free text with a `'manual'` default, and until now its
 * vocabulary was scattered across four writers as bare string literals. That
 * was survivable while only humans read it; it stopped being survivable when
 * automations began *matching* on it, because a trigger that filters on
 * "facebook_lead" and a webhook that writes "facebook_leads" fail silently and
 * identically to a flow nobody has triggered yet.
 *
 * So this module is the one place the values are spelled. Every writer imports
 * from here, the automations editor offers exactly this list, and the UI copy
 * at src/supabase/types/contact_source_types.ts mirrors it.
 *
 * Deliberately NOT a Postgres enum. Converting the column would mean a recast
 * that fails while an RLS policy references it (see the enum caveat in
 * acrm-api/CLAUDE.md), and it would make an unrecognised value a hard write
 * failure on an ingestion path — losing the lead — rather than a contact that
 * simply does not match a filter. Free text that one module owns keeps the
 * writes safe and the reads honest.
 */

/**
 * Contacts created by their own inbound message, as `<service>_message`.
 *
 * Only the channels that actually reach linkMissingContacts() — the WhatsApp
 * and Instagram webhooks. Email is send-only here (SES gives us bounces, not
 * inbound mail), so `email_message` would be a value nothing can produce.
 */
export const MESSAGE_SOURCE_SERVICES = ["whatsapp", "instagram"] as const;

/**
 * Contacts created by an address-book sync, stored as the bare service name.
 *
 * This is manage_contact_on_address_sync() in 02-03_trigger_functions.sql,
 * which writes `new.service::text` when a synced address arrives with no
 * contact behind it.
 */
export const SYNC_SOURCE_SERVICES = ["whatsapp", "instagram"] as const;

/** `whatsapp` -> `whatsapp_message`. */
export function messageSource(service: Service | string): string {
  return `${service}_message`;
}

export const CONTACT_SOURCES = {
  /** The column default: CSV import, manual creation, anything unattributed. */
  MANUAL: "manual",

  /** Wrote to us first, on that channel. */
  WHATSAPP_MESSAGE: "whatsapp_message",
  INSTAGRAM_MESSAGE: "instagram_message",

  /** Arrived through an address-book sync on that channel. */
  WHATSAPP_SYNC: "whatsapp",
  INSTAGRAM_SYNC: "instagram",

  /** Meta Lead Ads, split by the placement the form ran on. */
  FACEBOOK_LEAD: "facebook_lead",
  INSTAGRAM_LEAD: "instagram_lead",

  /** The public POST /lead-intake endpoint — website forms, Zapier, partners. */
  API_LEAD: "api_lead",
} as const;

export type ContactSource =
  (typeof CONTACT_SOURCES)[keyof typeof CONTACT_SOURCES];

/**
 * Every known source, in the order the editor should offer them: the default
 * first, then how someone arrived by messaging, then how they arrived as a
 * lead.
 *
 * A trigger may still legitimately match a value absent from this list — an
 * older row, or a channel added since — so consumers should treat it as the
 * known set rather than the possible set. The automations source picker unions
 * it with whatever the organization has actually used.
 */
export const CONTACT_SOURCE_LIST: ContactSource[] = [
  CONTACT_SOURCES.MANUAL,
  CONTACT_SOURCES.WHATSAPP_MESSAGE,
  CONTACT_SOURCES.INSTAGRAM_MESSAGE,
  CONTACT_SOURCES.WHATSAPP_SYNC,
  CONTACT_SOURCES.INSTAGRAM_SYNC,
  CONTACT_SOURCES.FACEBOOK_LEAD,
  CONTACT_SOURCES.INSTAGRAM_LEAD,
  CONTACT_SOURCES.API_LEAD,
];
