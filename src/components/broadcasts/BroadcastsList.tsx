import { LoaderCircle, Megaphone } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import SectionBody from "@/components/SectionBody";
import SectionHeader from "@/components/SectionHeader";
import SectionItem from "@/components/SectionItem";
import StatusBadge from "@/components/StatusBadge";
import { useTranslation } from "@/hooks/useTranslation";
import { useBroadcastBatches } from "@/queries/useBroadcasts";
import { batchStatus, batchStatusLabel, batchStatusTone } from "./batchStatus";
import { encodeBatchKey } from "./batchKey";
import { formatScheduledDate } from "./formatScheduledDate";

// Master list of the org's broadcast batches — one row per day-batch, not per
// campaign (a 5-day split send shows as 5 rows). Rendered in the left panel
// for both `/broadcasts` and `/broadcasts/$batchKey`; the detail fills the
// center panel (see BroadcastCenter, the broadcasts analogue of
// CalendarCenter/StatsCenter).
export default function BroadcastsList({ activeKey }: { activeKey?: string }) {
  const { translate: t, currentLanguage } = useTranslation();
  const navigate = useNavigate();
  const { data: batches, isLoading } = useBroadcastBatches();

  return (
    <>
      <SectionHeader title={t("Broadcasts")} />

      <SectionBody>
        {isLoading && (
          <div className="flex justify-center p-4">
            <LoaderCircle className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {batches?.sort((a, b) => new Date(b.scheduled_date).getTime() - new Date(a.scheduled_date).getTime()).map((batch) => {
          if (!batch.created_at || !batch.scheduled_date) return null;
          const key = encodeBatchKey(batch.created_at, batch.scheduled_date);
          const status = batchStatus({
            scheduled_date: batch.scheduled_date,
            recipient_count: batch.recipient_count ?? 0,
            pending_count: batch.pending_count ?? 0,
            failed_count: batch.failed_count ?? 0,
            cancelled_count: batch.cancelled_count ?? 0,
          });

          return (
            <SectionItem
              key={key}
              title={batch.template_name ?? t("Broadcast")}
              selected={key === activeKey}
              // Kept to 2 segments deliberately: SectionItem's description is
              // a single non-wrapping line (`truncate`), and under RTL an
              // overflowing flex row clips silently (no ellipsis, no
              // console warning) — a 3rd segment here previously pushed the
              // recipient count off the visible edge, which looked like a
              // missing translation but was actually a width overflow.
              description={
                <div className="flex items-center gap-2">
                  <span>
                    {formatScheduledDate(
                      batch.scheduled_date,
                      t,
                      currentLanguage,
                    )}
                  </span>
                  <span>·</span>
                  <span>
                    {t("Batch")} {(batch.batch_index ?? 0) + 1}/
                    {batch.batches_total}
                  </span>
                </div>
              }
              aside={
                <div className="p-[8px] bg-muted rounded-full">
                  <Megaphone className="w-[24px] h-[24px] text-muted-foreground" />
                </div>
              }
              actions={
                <StatusBadge
                  label={batchStatusLabel(status, t)}
                  tone={batchStatusTone(status)}
                />
              }
              onClick={() =>
                navigate({
                  to: "/broadcasts/$batchKey",
                  params: { batchKey: key },
                  hash: (prevHash: string | undefined) => prevHash!,
                })
              }
            />
          );
        })}

        {!isLoading && batches?.length === 0 && (
          <div className="p-8 text-center text-muted-foreground text-sm">
            {t("No broadcasts sent yet.")}
          </div>
        )}
      </SectionBody>
    </>
  );
}
