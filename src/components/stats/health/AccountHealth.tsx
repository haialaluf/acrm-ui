import { useMemo, useState } from "react";
import { LoaderCircle, ShieldAlert } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useOrganizationsAddresses } from "@/queries/useOrganizationsAddresses";
import { useWabaSpend } from "@/queries/useWabaSpend";
import {
  useHealthEvents,
  useHealthSnapshots,
  useMessageTemplatesMirror,
  useTemplateSends,
  useWhatsAppDailyMetrics,
} from "@/queries/useWhatsAppHealth";
import { buildHealthIssues, coalesceHealth, deriveRisk } from "./healthState";
import { aggregate, filterByAddress, splitWindows } from "./metrics";
import AccountFacts from "./AccountFacts";
import ColdChart from "./ColdChart";
import ErrorBreakdown from "./ErrorBreakdown";
import EventsTimeline from "./EventsTimeline";
import HealthHero from "./HealthHero";
import HealthIssues from "./HealthIssues";
import RateTiles from "./RateTiles";
import TemplatesTable from "./TemplatesTable";
import VolumeChart from "./VolumeChart";
import { FilterPill, Ltr } from "./primitives";

const RANGES = [7, 30, 90] as const;
/** Meta's own quality window is 30 days, so template volume matches it. */
const TEMPLATE_SEND_DAYS = 30;

/**
 * Per-number WhatsApp account health.
 *
 * Reads four independent sources — health snapshots, the daily-metrics RPC, the
 * template mirror and the events log — and answers one question at the top:
 * is this number at risk, and what should be done about it.
 */
export default function AccountHealth() {
  const { translate: t } = useTranslation();
  const [range, setRange] = useState<number>(30);
  const [selected, setSelected] = useState<string | null>(null);

  const { data: addresses, isLoading: addressesLoading } =
    useOrganizationsAddresses();

  const whatsappNumbers = useMemo(
    () =>
      (addresses ?? []).filter(
        (a) => a.service === "whatsapp" && a.status === "connected",
      ),
    [addresses],
  );

  const address = selected ?? whatsappNumbers[0]?.address ?? null;

  // Twice the displayed window, so the previous-period deltas come out of the
  // same request rather than a second round trip.
  const { data: metricRows, isLoading: metricsLoading } =
    useWhatsAppDailyMetrics(range * 2);
  const { data: snapshots, isLoading: snapshotsLoading } =
    useHealthSnapshots(address);
  const { data: templates } = useMessageTemplatesMirror(address);
  const { data: events } = useHealthEvents(address);
  const { data: templateSends } = useTemplateSends(TEMPLATE_SEND_DAYS);
  const { data: spend } = useWabaSpend(address ?? undefined, range);

  const { current, currentAgg, previousAgg } = useMemo(() => {
    const rows = filterByAddress(metricRows ?? [], address);
    const windows = splitWindows(rows, range);
    return {
      current: windows.current,
      currentAgg: aggregate(windows.current),
      previousAgg: aggregate(windows.previous),
    };
  }, [metricRows, address, range]);

  const state = useMemo(() => coalesceHealth(snapshots ?? []), [snapshots]);

  const issues = useMemo(
    () => buildHealthIssues(state, current, templates ?? [], t),
    [state, current, templates, t],
  );

  const risk = deriveRisk(state, issues);
  const todayVolume = current.at(-1)?.outgoing_count ?? 0;

  if (addressesLoading) return <Loading />;

  if (!whatsappNumbers.length) {
    return (
      <EmptyState
        title={t("No WhatsApp number connected")}
        body={t(
          "Connect a WhatsApp number to start monitoring its quality rating, sending limits and template health.",
        )}
      />
    );
  }

  const isLoading = snapshotsLoading || metricsLoading;
  // Only the hero, the issue list and the account facts need a health snapshot.
  // The charts are computed from `messages`, so they are just as useful before
  // the poller has ever run — blocking the whole page on a snapshot would hide
  // the data most likely to explain why sending is going wrong.
  const hasNeverBeenChecked = !snapshotsLoading && !snapshots?.length;

  return (
    <div className="@container flex flex-col gap-[14px] p-[24px] max-w-[1200px] mx-auto w-full">
      <header className="flex items-end justify-between gap-[16px] flex-wrap">
        <div className="min-w-0">
          <h2 className="text-[20px] font-medium">{t("WhatsApp account health")}</h2>
          <div className="flex items-center gap-[8px] text-[12.5px] mt-[4px] text-muted-foreground flex-wrap">
            <Ltr>{address}</Ltr>
            {state?.displayName && (
              <>
                <span>·</span>
                <span>{state.displayName}</span>
              </>
            )}
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

      {whatsappNumbers.length > 1 && (
        <div className="flex gap-[6px] flex-wrap">
          {whatsappNumbers.map((number) => (
            <FilterPill
              key={number.address}
              label={number.address}
              active={address === number.address}
              onClick={() => setSelected(number.address)}
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
              title={t("No health check has run for this number yet")}
              body={t(
                "The health check runs every 4 hours. Quality rating, sending limits and restrictions appear here once it has run. Your sending behaviour below is measured from your own messages and is already up to date.",
              )}
            />
          ) : (
            <HealthHero
              state={state}
              risk={risk}
              issues={issues}
              current={currentAgg}
              todayVolume={todayVolume}
              spend={spend}
              spendDays={range}
            />
          )}

          <div className="grid gap-[14px] items-start grid-cols-1">
            <aside className="flex flex-col gap-[14px] order-2 @3xl:order-1">
              {!hasNeverBeenChecked && <AccountFacts state={state} />}
              <EventsTimeline events={events ?? []} />
            </aside>
            <div className="flex flex-col gap-[14px] min-w-0 order-1 @3xl:order-2">
              {!hasNeverBeenChecked && <HealthIssues issues={issues} />}
              <VolumeChart days={current} />
              <RateTiles
                days={current}
                current={currentAgg}
                previous={previousAgg.outgoing > 0 ? previousAgg : null}
              />
              <ColdChart days={current} />
              <ErrorBreakdown aggregate={currentAgg} />
              <TemplatesTable
                templates={templates ?? []}
                sends={templateSends ?? []}
                sendWindowDays={TEMPLATE_SEND_DAYS}
              />
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

/** Stands in for the hero when the poller has no data on this number yet. */
function NotYetChecked({ title, body }: { title: string; body: string }) {
  return (
    <section className="bg-popover border border-border rounded-[16px] p-[20px] flex items-start gap-[12px]">
      <span className="rounded-full bg-muted p-[8px] shrink-0">
        <ShieldAlert className="w-[18px] h-[18px] text-muted-foreground" />
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
        <ShieldAlert className="w-[24px] h-[24px] text-muted-foreground" />
      </span>
      <div className="text-[15px] font-medium">{title}</div>
      <div className="text-[13px] text-muted-foreground leading-relaxed">
        {body}
      </div>
    </div>
  );
}
