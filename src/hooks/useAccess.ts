import { useCallback, useMemo } from "react";
import type { StepType } from "@/components/automations/catalog";
import type { ContactSource } from "@/supabase/client";
import { useIntegrations, type Integration } from "./useIntegrations";

/**
 * What each gated surface in the app requires before it may be shown.
 *
 * One table, read through one hook (`useAccess`) by two components
 * (`HideIfNotPermitted`, which renders nothing, and `IntegrationGate`, which
 * redirects) and by the handful of places that filter a list rather than show
 * or hide a block. Adding a gated surface means adding a row here, not writing
 * a rule at a call site — which is how `/templates` previously ended up spelled
 * two different ways in the nav rail and the shell.
 *
 * The rule is always *anyOf*: one listed integration connected is enough.
 * `allOf` is needed exactly once (a recipe that sends on two channels) and is
 * composed at that call site with `.every`, which keeps the rare case visible
 * instead of complicating every row.
 *
 * "Connected" means `status === "connected"` and nothing else — see
 * `useIntegrations`, which owns that question. This module owns only what the
 * answer permits.
 */

/** No integration required. Distinct from `[]`, which would permit nothing. */
const ALWAYS = "always" as const;

/** An outbound channel — something to actually send on. */
const CAN_SEND = ["whatsapp", "email"] as const;

/**
 * Any way in at all: a channel (WhatsApp, Instagram, Email) or a lead source
 * (Facebook, API) — the two groups the Integrations page names. Contacts can
 * exist either way, whether because someone messaged you or because a form was
 * submitted.
 *
 * Media pre-processing is absent on purpose: it is a setting on
 * `organizations.extra` rather than a row in `organizations_addresses`, and it
 * enriches media arriving through one of these rather than being a way in of
 * its own. Switching it on unlocks nothing.
 */
const ANY_INTEGRATION = [
  "whatsapp",
  "instagram",
  "facebook",
  "email",
  "api",
] as const;

type Requirement = typeof ALWAYS | readonly Integration[];

/**
 * Keys the table must cover completely. A new `StepType` or `ContactSource`
 * fails to compile until it has been classified here, which is the point: the
 * failure mode otherwise is silent — an option that is simply never offered, or
 * one offered to an organization that can never receive it.
 */
type ExhaustiveSurfaces = Record<
  `step.${StepType}` | `source.${ContactSource}`,
  Requirement
>;

export const SURFACES = {
  // ── Sections ───────────────────────────────────────────────────────────
  // Read by the nav rail (which hides the button) and by the shell (which
  // redirects). Every section NOT listed is always reachable, deliberately:
  //   /conversations — message history outlives the connection that produced
  //     it, and burying a year of customer threads behind a disconnect is
  //     worse than an inbox you cannot currently send from.
  //   /agents — worth writing before there is a channel to answer on.
  //   /stats — Quotas and Usage report the subscription, not a channel. An
  //     agent chatted with over the `local` address spends AI Credits with
  //     nothing connected, and Storage keeps counting media from a channel
  //     since disconnected. Its two per-channel health tabs gate themselves.
  //   /integrations — the section that changes all of this.
  //   /settings — where an owner manages the organization, its members and its
  //     API keys. Locking it would strand anyone whose next step is fixing the
  //     organization rather than connecting a channel.
  // The trade-off against an allowlist: a section added later defaults to
  // reachable rather than hidden. That is the safer failure for a section that
  // needs no channel, which is the common case — but a new channel-dependent
  // section must remember to add a row here and to GATED_SECTIONS.
  "/broadcasts": CAN_SEND,
  /** Per-channel all the way down, so with neither connected there is
   *  nothing to list. */
  "/templates": CAN_SEND,
  /** A booking link is just a URL, shareable from a website, an ad or a QR
   *  code, so any integration is enough. Leads especially: booking the ones
   *  that arrive is the point of collecting them. */
  "/calendars": ANY_INTEGRATION,
  "/contacts": ANY_INTEGRATION,
  /** A lead arriving from the API can be tagged, routed and assigned with no
   *  channel at all. */
  "/automations": ANY_INTEGRATION,

  // ── Routes needing something narrower than their section ───────────────
  // A section grants "you can send *something*"; these each author on one
  // specific channel, so they gate again on that one.
  "/templates/new": ["whatsapp"],
  "/templates/$templateId": ["whatsapp"],
  "/templates/email/new": ["email"],
  "/templates/email/$emailTemplateId": ["email"],
  "/conversations/bulk-send": CAN_SEND,
  /** Sending reputation for one channel: only meaningful, and only reachable,
   *  while that channel is connected. */
  "/stats/health": ["whatsapp"],
  "/stats/email": ["email"],

  // ── Widgets ────────────────────────────────────────────────────────────
  /** Read *inverted*, by the home panel's "connect something" card: the one
   *  place in the app that appears because nothing is connected. */
  "app.connected": ANY_INTEGRATION,
  /** Nothing to start a conversation on without a channel, and the wizard
   *  behind the button is itself gated — the link would only bounce. */
  "header.newConversation": CAN_SEND,
  "home.startConversation": CAN_SEND,
  /** Only the create button. Past broadcasts stay listed in full whatever
   *  happened to the channel they went out on. */
  "broadcasts.create": CAN_SEND,
  /** Reopening a closed conversation means sending a template, which needs a
   *  live connection — not merely a conversation that once was one. Combined
   *  at the call site with the conversation's own `service`. */
  "chat.reopenWithTemplate": ["whatsapp"],

  // ── Channels ───────────────────────────────────────────────────────────
  // The channel toggles, bulk-send's `available`, and the recipe filter.
  "channel.whatsapp": ["whatsapp"],
  "channel.email": ["email"],

  // ── Automation step types ──────────────────────────────────────────────
  // Which steps can be *added*. Only the messaging steps are gated: a step
  // that sends on a channel you have not connected is one that silently does
  // nothing at run time. Steps already saved in a flow are untouched —
  // `catalog.ts` deliberately keeps every type so the canvas can still draw
  // them and StepPanel can still open their editors.
  "step.template": ["whatsapp"],
  "step.email": ["email"],
  "step.wait": ALWAYS,
  "step.waittime": ALWAYS,
  "step.split": ALWAYS,
  "step.condition": ALWAYS,
  "step.filter": ALWAYS,
  "step.assign": ALWAYS,
  "step.tag": ALWAYS,
  "step.webhook": ALWAYS,

  // ── Contact sources ────────────────────────────────────────────────────
  // Which sources an automation trigger may match on. Offering one whose
  // channel is not connected means offering a trigger that could never fire.
  // (Sources the organization has actually *received* are appended unfiltered
  // by useContactSourceOptions, so a saved selection stays selectable after a
  // disconnect.)
  /** Import and hand entry always work. */
  "source.manual": ALWAYS,
  "source.whatsapp_message": ["whatsapp"],
  "source.instagram_message": ["instagram"],
  /** The address-book sync sources, stored as the bare service name. */
  "source.whatsapp": ["whatsapp"],
  "source.instagram": ["instagram"],
  "source.facebook_lead": ["facebook"],
  /** A Meta Lead Ads form, split by the placement it ran on — so an Instagram
   *  lead needs the Instagram connection, not the Facebook one. */
  "source.instagram_lead": ["instagram"],
  "source.api_lead": ["api"],
} as const satisfies ExhaustiveSurfaces & Record<string, Requirement>;

export type Surface = keyof typeof SURFACES;

/**
 * Section prefixes the shell matches a pathname against, in the order it tries
 * them. Every entry is a `Surface`, so the requirement itself lives in the
 * table above rather than here.
 */
export const GATED_SECTIONS = [
  "/broadcasts",
  "/templates",
  "/calendars",
  "/contacts",
  "/automations",
] as const satisfies readonly Surface[];

export type GatedSection = (typeof GATED_SECTIONS)[number];

/**
 * Answers whether a surface may be shown.
 *
 * Returns a predicate rather than a record because half the callers test keys
 * inside a `filter` — step types, contact sources — where a record would mean
 * building the whole table's worth of booleans to read three of them.
 *
 * `isResolved` is the caller's decision to make, and the two components make it
 * differently on purpose: hiding on `!allows(...)` alone is right (a surface
 * that appears a beat late is invisible; one that appears and vanishes is not),
 * while redirecting must wait for `isResolved` or a hard refresh would bounce a
 * bookmarked URL every time.
 */
export function useAccess() {
  const { connected, isResolved, isLoading } = useIntegrations();

  const allows = useCallback(
    (surface: Surface) => {
      const required: Requirement = SURFACES[surface];
      return required === ALWAYS || required.some((key) => connected[key]);
    },
    [connected],
  );

  return { allows, isResolved, isLoading };
}

/** A channel the organization can author and send on. */
export type OutboundChannel = "whatsapp" | "email";

/**
 * The channels this organization can send on, in the order the toggles show
 * them — email first, which is what makes it the default a two-channel
 * organization lands on. A WhatsApp-only organization still lands on WhatsApp,
 * because email is simply absent from the list.
 *
 * Reach for this only where the list itself is needed (the channel toggles,
 * bulk-send's `available`); a yes/no answer is `allows("channel.email")`.
 */
export function useOutboundChannels() {
  const { allows } = useAccess();

  const channels = useMemo<OutboundChannel[]>(() => {
    const list: OutboundChannel[] = [];
    if (allows("channel.email")) list.push("email");
    if (allows("channel.whatsapp")) list.push("whatsapp");
    return list;
  }, [allows]);

  return { channels };
}
