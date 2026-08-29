import { useMemo } from "react";
import {
  useProducts,
  useUsage,
  useTierLimits,
  usePlanProducts,
  useCreditGrants,
} from "@/queries/useBilling";

/** Fraction of an allowance at which a not-yet-reached limit is surfaced as a
 *  warning. Below this the org has room and the banner stays hidden. */
const NEAR_THRESHOLD = 0.9;

/** Slugs of the limits that actually stop something the app lets you do, so a
 *  reached one is worth blocking the relevant control for — not just the
 *  informational quotas (a plan cap on, say, seats reads as a banner only). */
const HARD_LIMIT_KEYS = new Set([
  "messages",
  "conversations",
  "ai-credits",
  "storage",
]);

/** A single quota, reduced to what the banner and the blocked controls need.
 *  Mirrors the reading `StatsQuotas` / `QuotaBar` build from the same billing
 *  tables, so the numbers here line up with the Quotas page. */
export type PlanLimitReading = {
  /** stable slug derived from the product name — "messages", "ai-credits", … */
  key: string;
  productId: string;
  /** raw product name; translate at the render site */
  name: string;
  /** billing.products.kind — "counter" | "gauge" | "balance" */
  kind: string;
  /** billing.products.unit — "count" | "usd" | "mb" */
  unit: string;
  /** "month" | "lifetime" */
  interval: string;
  /** counter/gauge: amount consumed. balance: amount still available. */
  used: number;
  /** counter/gauge: the ceiling. balance: the entitlement it's measured against. */
  cap: number;
  /** fraction of the allowance consumed, 0–1+ */
  ratio: number;
  reached: boolean;
  /** at or past the warning threshold but not yet reached */
  near: boolean;
};

export type PlanLimitsResult = {
  /** every limit at or past the warning threshold, worst first */
  readings: PlanLimitReading[];
  /** reached limits that stop an action the app offers (messages/storage/ai) */
  blocking: PlanLimitReading[];
  isLoading: boolean;
};

function slug(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, "-");
}

export function usePlanLimits(): PlanLimitsResult {
  const { data: products } = useProducts();
  const { data: monthUsage } = useUsage("month");
  const { data: lifetimeUsage } = useUsage("lifetime");
  const { data: tierLimits } = useTierLimits();
  const { data: planProducts } = usePlanProducts();
  const { data: grants } = useCreditGrants();

  return useMemo<PlanLimitsResult>(() => {
    const isLoading = !products || !tierLimits;
    if (isLoading || !products || !tierLimits) {
      return { readings: [], blocking: [], isLoading: true };
    }

    const monthMap = new Map(
      monthUsage?.map((u) => [u.product_id, u.quantity]),
    );
    const lifetimeMap = new Map(
      lifetimeUsage?.map((u) => [u.product_id, u.quantity]),
    );
    const tierMap = new Map(
      tierLimits.map((tl) => [
        tl.product_id,
        { cap: tl.cap, interval: tl.interval },
      ]),
    );
    const planMap = new Map(
      planProducts?.map((pp) => [pp.product_id, pp.included]),
    );
    // Balance products read against what was actually granted, not the plan's
    // catalogue allowance — see useCreditGrants.
    const grantMap = new Map<string, number>();
    for (const g of grants ?? []) {
      grantMap.set(
        g.product_id,
        (grantMap.get(g.product_id) ?? 0) + g.quantity,
      );
    }

    const all: PlanLimitReading[] = [];

    for (const product of products) {
      const tier = tierMap.get(product.id);
      if (!tier) continue; // not part of this org's tier — nothing to cap

      const isLifetime = tier.interval === "lifetime";
      const raw = isLifetime
        ? (lifetimeMap.get(product.id) ?? 0)
        : (monthMap.get(product.id) ?? 0);

      let used: number;
      let cap: number;
      let ratio: number;
      let reached: boolean;

      if (product.kind === "balance") {
        // `raw` is the balance still available; `cap` is a floor (min allowed
        // balance, usually 0), not a ceiling. Measure spend against what the
        // org was actually given, falling back to the catalogue allowance only
        // when no grant is on record — same order QuotaBar uses.
        const remaining = raw;
        const entitlement =
          grantMap.get(product.id) ??
          (tier.cap && tier.cap > 0
            ? tier.cap
            : (planMap.get(product.id) ?? 0));
        const total = Math.max(entitlement, remaining);
        used = remaining;
        cap = total;
        ratio = total > 0 ? (total - remaining) / total : 0;
        reached = remaining <= (tier.cap ?? 0);
      } else {
        const total = tier.cap ?? 0;
        used = raw;
        cap = total;
        ratio = total > 0 ? raw / total : 0;
        reached = total > 0 && raw >= total;
      }

      all.push({
        key: slug(product.name),
        productId: product.id,
        name: product.name,
        kind: product.kind,
        unit: product.unit,
        interval: tier.interval,
        used,
        cap,
        ratio,
        reached,
        near: !reached && ratio >= NEAR_THRESHOLD,
      });
    }

    const readings = all
      .filter((r) => r.reached || r.near)
      .sort(
        (a, b) => Number(b.reached) - Number(a.reached) || b.ratio - a.ratio,
      );

    const blocking = all.filter((r) => r.reached && HARD_LIMIT_KEYS.has(r.key));

    return { readings, blocking, isLoading: false };
  }, [products, monthUsage, lifetimeUsage, tierLimits, planProducts, grants]);
}
