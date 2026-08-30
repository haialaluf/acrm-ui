/**
 * Shared `staleTime` values for react-query.
 *
 * The client is created with no defaults, so a query without `staleTime` is
 * stale the instant it resolves and refetches on every remount, key change and
 * window focus. Rows that a mutation always invalidates (or that only ever
 * change server-side, rarely) don't need that — they opt into one of these.
 */

/** Contacts, contact addresses: edited rarely, and every UI write path
 *  invalidates them. Server-side status flips (`removed` / `inactive`) can lag
 *  by this much; a window refocus still refetches. */
export const CONTACT_STALE_TIME = 5 * 60 * 1000;

/** Org / team / channel / calendar / automation / template config: changes
 *  rarely, through mutations that invalidate their own keys, or server-side
 *  (integration status) where a focus refetch is soon enough. */
export const CONFIG_STALE_TIME = 5 * 60 * 1000;

/** Data whose only in-session change path is an in-app mutation that
 *  invalidates its key — API keys, webhooks. Nothing writes it behind our
 *  back, so it never needs a timed refetch. A second tab sees a change on its
 *  next mutation or reload. */
export const STATIC_STALE_TIME = Infinity;

/** Billing plan / subscription / entitlements. Deliberately short: a plan
 *  change or credit top-up happens off-app (Stripe) and the user expects the
 *  new state the moment they return to the tab, which a focus refetch gives
 *  them — this only collapses rapid duplicate fetches. */
export const BILLING_STALE_TIME = 10 * 1000;
