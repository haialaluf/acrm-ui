import { useTranslation } from "@/hooks/useTranslation";
import {
  useProducts,
  useUsage,
  useTierLimits,
  usePlanProducts,
  useCreditGrants,
} from "@/queries/useBilling";
import QuotaBar from "./QuotaBar";
import StatsPanel from "./StatsPanel";

export default function StatsQuotas() {
  const { translate: t } = useTranslation();
  const { data: products } = useProducts();
  const { data: monthUsage } = useUsage("month");
  const { data: lifetimeUsage } = useUsage("lifetime");
  const { data: tierLimits } = useTierLimits();
  const { data: planProducts } = usePlanProducts();
  const { data: grants } = useCreditGrants();

  const monthMap = new Map(monthUsage?.map((u) => [u.product_id, u.quantity]));
  const lifetimeMap = new Map(
    lifetimeUsage?.map((u) => [u.product_id, u.quantity]),
  );
  const tierMap = new Map(
    tierLimits?.map((tl) => [
      tl.product_id,
      { cap: tl.cap, interval: tl.interval },
    ]),
  );
  // Balance products read against what was actually granted, not the plan's
  // catalogue allowance — see useCreditGrants.
  const grantMap = new Map<string, number>();
  for (const g of grants ?? []) {
    grantMap.set(g.product_id, (grantMap.get(g.product_id) ?? 0) + g.quantity);
  }

  const planMap = new Map(
    planProducts?.map((pp) => [
      pp.product_id,
      { included: pp.included, interval: pp.interval },
    ]),
  );

  const visibleProducts = products?.filter((p) => tierMap.has(p.id));

  return (
    <StatsPanel title={t("Quotas")}>
      <div className="flex flex-col gap-[16px]">
        {visibleProducts?.map((product) => {
          const tier = tierMap.get(product.id)!;
          const plan = planMap.get(product.id);
          const isLifetime = tier.interval === "lifetime";
          const used = isLifetime
            ? (lifetimeMap.get(product.id) ?? 0)
            : (monthMap.get(product.id) ?? 0);

          return (
            <QuotaBar
              key={product.id}
              productName={product.name}
              kind={product.kind}
              unit={product.unit}
              interval={tier.interval}
              used={used}
              included={plan?.included ?? null}
              granted={grantMap.get(product.id) ?? null}
              cap={tier.cap}
            />
          );
        })}
        {!visibleProducts?.length && (
          <div className="text-muted-foreground text-center py-[40px]">
            {t("No quotas configured")}
          </div>
        )}
      </div>
    </StatsPanel>
  );
}
