import { useState } from "react";
import { CalendarClock, LoaderCircle, Plus } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import ConfirmModal from "@/components/ConfirmModal";
import SectionHeader from "@/components/SectionHeader";
import { useTranslation } from "@/hooks/useTranslation";
import HideIfNotPermitted from "@/components/HideIfNotPermitted";
import useBoundStore from "@/stores/useBoundStore";
import type { BroadcastsTab } from "@/stores/uiSlice";
import {
  type BroadcastBatchRow,
  useBroadcastBatches,
  useCancelBroadcastBatch,
} from "@/queries/useBroadcasts";
import { batchStatus, isUpcomingBatch } from "./batchStatus";
import { batchSortValue } from "./formatScheduledDate";
import { encodeBatchKey } from "./batchKey";
import BroadcastCard from "./BroadcastCard";

// Master list of the org's broadcast batches — one card per day-batch, not per
// campaign (a 5-day split send shows as 5 cards). Rendered in the left panel
// for both `/broadcasts` and `/broadcasts/$batchKey`; the detail fills the
// center panel (see BroadcastCenter, the broadcasts analogue of
// CalendarCenter/StatsCenter).
export default function BroadcastsList({ activeKey }: { activeKey?: string }) {
  const { translate: t } = useTranslation();
  const navigate = useNavigate();
  const { data: batches, isLoading } = useBroadcastBatches();
  const cancelBatch = useCancelBroadcastBatch();

  // null until the user picks a tab, so the default can follow the data (and
  // the open batch) instead of being frozen at first render. Kept in the store
  // because this panel unmounts on the /broadcasts <-> /broadcasts/$batchKey
  // switch, which would otherwise drop a History selection on every back.
  const tab = useBoundStore((state) => state.ui.broadcastsTab);
  const setTab = useBoundStore((state) => state.ui.setBroadcastsTab);
  const [cancelTarget, setCancelTarget] = useState<BroadcastBatchRow | null>(
    null,
  );

  const rows = (batches ?? [])
    .filter((b) => b.created_at && b.scheduled_date)
    .map((b) => ({
      batch: b,
      key: encodeBatchKey(b.created_at, b.scheduled_date),
      upcoming: isUpcomingBatch(
        batchStatus({
          scheduled_date: b.scheduled_date,
          scheduled_at: b.scheduled_at,
          recipient_count: b.recipient_count ?? 0,
          pending_count: b.pending_count ?? 0,
          failed_count: b.failed_count ?? 0,
          cancelled_count: b.cancelled_count ?? 0,
        }),
      ),
    }));

  // Soonest first for what is still coming, most recent first for what is done.
  // By send instant rather than by day: two batches of the same campaign can
  // share a date at different hours, and the day alone leaves their order to
  // however the RPC happened to return them.
  const upcoming = rows
    .filter((r) => r.upcoming)
    .sort((a, b) => batchSortValue(a.batch) - batchSortValue(b.batch));
  const history = rows
    .filter((r) => !r.upcoming)
    .sort((a, b) => batchSortValue(b.batch) - batchSortValue(a.batch));

  const activeRow = activeKey ? rows.find((r) => r.key === activeKey) : null;
  const activeTab: BroadcastsTab =
    tab ??
    (activeRow
      ? activeRow.upcoming
        ? "upcoming"
        : "history"
      : upcoming.length > 0 || history.length === 0
        ? "upcoming"
        : "history");

  const list = activeTab === "upcoming" ? upcoming : history;

  function confirmCancel() {
    if (!cancelTarget) return;
    cancelBatch.mutate(
      {
        createdAt: cancelTarget.created_at,
        scheduledDate: cancelTarget.scheduled_date,
      },
      { onSuccess: () => setCancelTarget(null) },
    );
  }

  return (
    <>
      <SectionHeader title={t("Broadcasts")} />

      {/* Upcoming / history split */}
      <div className="shrink-0 px-[12px] pb-[10px] flex gap-[6px]">
        <SubTab
          active={activeTab === "upcoming"}
          onClick={() => setTab("upcoming")}
        >
          {t("Upcoming")}
          {upcoming.length > 0 && (
            <span
              className={
                "rounded-full px-[6px] text-[11px] " +
                (activeTab === "upcoming"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground")
              }
            >
              {upcoming.length}
            </span>
          )}
        </SubTab>
        <SubTab
          active={activeTab === "history"}
          onClick={() => setTab("history")}
        >
          {t("History")}
        </SubTab>
      </div>

      <div className="overflow-y-auto [scrollbar-gutter:stable] grow px-[12px] pb-[12px] flex flex-col gap-[8px]">
        {isLoading && (
          <div className="flex justify-center p-4">
            <LoaderCircle className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {list.map((row) => (
          <BroadcastCard
            key={row.key}
            batch={row.batch}
            selected={row.key === activeKey}
            onOpen={() =>
              navigate({
                to: "/broadcasts/$batchKey",
                params: { batchKey: row.key },
                hash: (prevHash: string | undefined) => prevHash!,
              })
            }
            onCancel={() => setCancelTarget(row.batch)}
          />
        ))}

        {!isLoading && list.length === 0 && (
          <div className="grow flex flex-col items-center justify-center text-center py-[60px] px-[24px]">
            <div className="rounded-full flex items-center justify-center mb-[14px] w-[66px] h-[66px] bg-primary/8">
              <CalendarClock className="w-[28px] h-[28px] text-primary" />
            </div>
            <div className="text-[15px] mb-[5px]">
              {activeTab === "upcoming"
                ? t("No scheduled broadcasts")
                : t("No past broadcasts")}
            </div>
            <div className="text-[12px] text-muted-foreground max-w-[260px] leading-[18px]">
              {activeTab === "upcoming"
                ? t(
                    "Every broadcast you schedule shows up here — you can cancel it up until it goes out.",
                  )
                : t(
                    "Broadcasts that finished or were cancelled show up here with their delivery stats.",
                  )}
            </div>
          </div>
        )}
      </div>

      <HideIfNotPermitted surface="broadcasts.create">
        <div className="shrink-0 px-[16px] py-[12px] border-t border-border">
          <button
            className="primary w-full h-[44px] flex items-center justify-center gap-[8px] text-[14px]"
            onClick={() =>
              navigate({
                to: "/conversations/bulk-send",
                hash: (prevHash: string | undefined) => prevHash!,
              })
            }
          >
            <Plus className="w-[17px] h-[17px]" />
            {t("New broadcast")}
          </button>
        </div>
      </HideIfNotPermitted>

      <ConfirmModal
        open={!!cancelTarget}
        title={t("Cancel this batch?")}
        confirmLabel={t("Cancel batch")}
        loading={cancelBatch.isPending}
        onConfirm={confirmCancel}
        onCancel={() => setCancelTarget(null)}
        body={
          <>
            <p className="text-[15px] text-foreground">
              {t("This will cancel the still-pending messages in this batch.")}
            </p>
            <p className="text-[13px] text-muted-foreground mt-2">
              {t("This action cannot be undone.")}
            </p>
          </>
        }
      />
    </>
  );
}

function SubTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      className={
        "flex items-center justify-center gap-[6px] flex-1 px-[12px] py-[7px] rounded-full text-[13px] border transition-colors " +
        (active
          ? "bg-primary/10 border-primary text-primary"
          : "bg-background border-border text-foreground hover:bg-accent/50")
      }
      onClick={onClick}
    >
      {children}
    </button>
  );
}
