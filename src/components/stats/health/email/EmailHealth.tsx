import { useMemo, useState } from "react";
import { LoaderCircle, MailWarning } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useOrganizationsAddresses } from "@/queries/useOrganizationsAddresses";
import {
  useEmailDailyMetrics,
  useEmailHealthEvents,
  useEmailHealthSnapshots,
} from "@/queries/useEmailHealth";
import EventsTimeline from "../EventsTimeline";
import HealthIssues from "../HealthIssues";
import { FilterPill, Ltr } from "../primitives";
import EmailAccountFacts from "./EmailAccountFacts";
import EmailHero from "./EmailHero";
import EmailRateTiles from "./EmailRateTiles";
import EmailVolumeChart from "./EmailVolumeChart";
import SuppressionSummary from "./SuppressionSummary";
import {
  buildEmailHealthIssues,
  coalesceEmailHealth,
  deriveEmailRisk,
} from "./emailHealthState";
import {
  aggregateEmail,
  filterByAddress,
  splitEmailWindows,
} from "./emailMetrics";

const RANGES = [7, 30, 90] as const;

/**
 * Per-domain email deliverability.
 *
 * The counterpart of AccountHealth, answering the two questions that had no
 * answer anywhere in this product: is anyone reporting our email as spam, and
 * are we mailing addresses that do not exist. Both signals were already being
 * captured — by email-webhook, from SNS — and then read by nothing.
 */
export default function EmailHealth() {
  const { translate: t } = useTranslation();
  const [range, setRange] = useState<number>(30);
  const [selected, setSelected] = useState<string | null>(null);

  const { data: addresses, isLoading: addressesLoading } =
    useOrganizationsAddresses();

  const domains = useMemo(
    () =>
      (addresses ?? []).filter(
        (a) => a.service === "email" && a.status === "connected",
      ),
    [addresses],
  );

  const address = selected ?? domains[0]?.address ?? null;

  // Twice the displayed window, so the previous-period deltas come out of the
  // same request rather than a second round trip.
  const { data: metricRows, isLoading: metricsLoading } = useEmailDailyMetrics(
    range * 2,
  );
  const { data: snapshots, isLoading: snapshotsLoading } =
    useEmailHealthSnapshots(address);
  const { data: events } = useEmailHealthEvents(address);

  const { current, currentAgg, previousAgg } = useMemo(() => {
    const rows = filterByAddress(metricRows ?? [], address);
    const windows = splitEmailWindows(rows, range);

    return {
      current: windows.current,
      currentAgg: aggregateEmail(windows.current),
      previousAgg: aggregateEmail(windows.previous),
    };
  }, [metricRows, address, range]);

  const state = useMemo(
    () => coalesceEmailHealth(snapshots ?? []),
    [snapshots],
  );

  const issues = useMemo(
    () => buildEmailHealthIssues(state, current, t),
    [state, current, t],
  );

  const risk = deriveEmailRisk(state, issues);

  if (addressesLoading) return <Loading />;

  if (!domains.length) {
    return (
      <EmptyState
        title={t("No sending domain connected")}
        body={t(
          "Connect a domain to start sending email and monitoring its bounce rate, spam complaints and blocked addresses.",
        )}
      />
    );
  }

  const isLoading = snapshotsLoading || metricsLoading;
  // Only the hero and the SES facts need a snapshot. Everything else is
  // computed from `messages`, so it is just as useful before the poller has
  // ever run — blocking the whole page on a snapshot would hide the data most
  // likely to explain why sending is going wrong.
  const hasNeverBeenChecked = !snapshotsLoading && !snapshots?.length;

  return (
    <div className="@container flex flex-col gap-[14px] p-[24px] max-w-[1200px] mx-auto w-full">
      <header className="flex items-end justify-between gap-[16px] flex-wrap">
        <div className="min-w-0">
          <h2 className="text-[20px] font-medium">{t("Email health")}</h2>
          <div className="flex items-center gap-[8px] text-[12.5px] mt-[4px] text-muted-foreground flex-wrap">
            <Ltr>{address}</Ltr>
            {state?.lastCheckedAt && (
              <>
                <span>·</span>
                <span>
                  {t("Last checked")}{" "}
                  {new Date(state.lastCheckedAt).toLocaleString(undefined, {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </>
            )}
          </div>
        </div>
        <div className="flex gap-[6px] shrink-0">
          {RANGES.map((n) => (
            <FilterPill
              key={n}
              label={`${n} ${t("days")}`}
              active={range === n}
              onClick={() => setRange(n)}
            />
          ))}
        </div>
      </header>

      {domains.length > 1 && (
        <div className="flex gap-[6px] flex-wrap">
          {domains.map((domain) => (
            <FilterPill
              key={domain.address}
              label={domain.address}
              active={address === domain.address}
              onClick={() => setSelected(domain.address)}
            />
          ))}
        </div>
      )}

      {isLoading ? (
        <Loading />
      ) : (
        <>
          {hasNeverBeenChecked ? (
            <NotYetChecked
              title={t("No health check has run for this domain yet")}
              body={t(
                "The health check runs every 4 hours. Amazon SES's own verdict on your sending appears here once it has run. The figures below are measured from your own messages and are already up to date.",
              )}
            />
          ) : (
            <EmailHero
              state={state}
              risk={risk}
              issues={issues}
              current={currentAgg}
            />
          )}

          <div className="grid gap-[14px] items-start grid-cols-1">
            <aside className="flex flex-col gap-[14px] order-2 @3xl:order-1">
              {!hasNeverBeenChecked && <EmailAccountFacts state={state} />}
              <SuppressionSummary />
              <EventsTimeline events={events ?? []} />
            </aside>
            <div className="flex flex-col gap-[14px] min-w-0 order-1 @3xl:order-2">
              <HealthIssues
                issues={issues}
                emptyBody={t(
                  "No deliverability problems reported by Amazon SES, and your bounce and spam-complaint rates are within the safe range.",
                )}
              />
              <EmailRateTiles
                current={currentAgg}
                previous={previousAgg.sent > 0 ? previousAgg : null}
              />
              <EmailVolumeChart days={current} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Loading() {
  return (
    <div className="flex justify-center p-[32px]">
      <LoaderCircle className="w-[24px] h-[24px] animate-spin text-muted-foreground" />
    </div>
  );
}

/** Stands in for the hero when the poller has no data on this domain yet. */
function NotYetChecked({ title, body }: { title: string; body: string }) {
  return (
    <section className="bg-popover border border-border rounded-[16px] p-[20px] flex items-start gap-[12px]">
      <span className="rounded-full bg-muted p-[8px] shrink-0">
        <MailWarning className="w-[18px] h-[18px] text-muted-foreground" />
      </span>
      <div className="min-w-0">
        <div className="text-[14px] font-semibold">{title}</div>
        <div className="text-[12.5px] text-muted-foreground mt-[2px] leading-relaxed">
          {body}
        </div>
      </div>
    </section>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col items-center text-center gap-[10px] p-[32px] max-w-[420px] mx-auto">
      <span className="rounded-full bg-muted p-[12px]">
        <MailWarning className="w-[24px] h-[24px] text-muted-foreground" />
      </span>
      <div className="text-[15px] font-medium">{title}</div>
      <div className="text-[13px] text-muted-foreground leading-relaxed">
        {body}
      </div>
    </div>
  );
}
