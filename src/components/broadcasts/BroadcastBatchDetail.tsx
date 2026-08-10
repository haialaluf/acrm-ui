import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import Button from "@/components/Button";
import ConfirmModal from "@/components/ConfirmModal";
import SectionHeader from "@/components/SectionHeader";
import StatTile from "@/components/StatTile";
import StatusBadge from "@/components/StatusBadge";
import { useTranslation } from "@/hooks/useTranslation";
import {
  useBroadcastBatches,
  useBroadcastBatchMessages,
  useCancelBroadcastBatch,
} from "@/queries/useBroadcasts";
import { batchStatus, batchStatusLabel, batchStatusTone } from "./batchStatus";
import { formatScheduledDate } from "./formatScheduledDate";
import { messageMatchesStatus, messageStatusLabel } from "./messageStatus";
import type { MessageStatusKind } from "./messageStatus";

// One batch's stats + recipient list + cancel action. Fills the center panel
// (see BroadcastCenter, wired from _auth.tsx like CalendarCenter/StatsCenter).
export default function BroadcastBatchDetail({
  createdAt,
  scheduledDate,
}: {
  createdAt: string;
  scheduledDate: string;
}) {
  const { translate: t, currentLanguage } = useTranslation();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  // Clicking a stat tile filters the recipient list to that status; clicking
  // the same tile again clears the filter.
  const [statusFilter, setStatusFilter] = useState<MessageStatusKind | null>(
    null,
  );

  // Batch-level stats already come aggregated from the same list query the
  // left panel uses — no separate stats fetch needed.
  const { data: batches } = useBroadcastBatches();
  const batch = batches?.find(
    (b) => b.created_at === createdAt && b.scheduled_date === scheduledDate,
  );
  const { data: messages, isLoading: messagesLoading } =
    useBroadcastBatchMessages(createdAt, scheduledDate);
  const cancelBatch = useCancelBroadcastBatch();

  if (!batch) return null;

  const status = batchStatus({
    scheduled_date: batch.scheduled_date ?? scheduledDate,
    recipient_count: batch.recipient_count ?? 0,
    pending_count: batch.pending_count ?? 0,
    failed_count: batch.failed_count ?? 0,
    cancelled_count: batch.cancelled_count ?? 0,
  });
  const canCancel = (batch.pending_count ?? 0) > 0;

  const filteredMessages = messages?.filter(
    (m) => !statusFilter || messageMatchesStatus(m.status, statusFilter),
  );

  function toggleFilter(kind: MessageStatusKind) {
    setStatusFilter((cur) => (cur === kind ? null : kind));
  }

  function confirmCancel() {
    cancelBatch.mutate(
      { createdAt, scheduledDate },
      { onSuccess: () => setConfirming(false) },
    );
  }

  function openContact(contactId: string | null) {
    if (!contactId) return;
    void navigate({
      to: "/contacts/$contactId",
      params: { contactId },
      hash: (prevHash: string | undefined) => prevHash!,
    });
  }

  const tiles: {
    kind: MessageStatusKind;
    label: string;
    value: number;
    color: string;
  }[] = [
    {
      kind: "pending",
      label: t("Pending"),
      value: batch.pending_count ?? 0,
      color: "var(--foreground)",
    },
    {
      kind: "sent",
      label: t("Sent"),
      value: batch.sent_count ?? 0,
      color: "var(--foreground)",
    },
    {
      kind: "delivered",
      label: t("Delivered"),
      value: batch.delivered_count ?? 0,
      color: "var(--success)",
    },
    {
      kind: "read",
      // An email "read" is an SES Open event — the tracking pixel loading — not
      // a read receipt. See EMAIL_KIND_LABELS in messageStatus.ts.
      label: batch.service === "email" ? t("Opened") : t("Read"),
      value: batch.read_count ?? 0,
      color: "var(--success)",
    },
    {
      kind: "failed",
      label: t("Failed"),
      value: batch.failed_count ?? 0,
      color: "var(--destructive)",
    },
    {
      kind: "cancelled",
      label: t("Cancelled"),
      value: batch.cancelled_count ?? 0,
      color: "var(--muted-foreground)",
    },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden bg-muted">
      <SectionHeader
        title={batch.template_name ?? t("Broadcast")}
        hideBackButton
        action={
          <StatusBadge
            label={batchStatusLabel(status, t)}
            tone={batchStatusTone(status)}
          />
        }
      />

      <div className="overflow-y-auto grow p-[24px] max-w-[900px] mx-auto w-full flex flex-col gap-[20px]">
        <div className="text-[14px] text-muted-foreground">
          {formatScheduledDate(
            batch.scheduled_date ?? scheduledDate,
            t,
            currentLanguage,
          )}{" "}
          · {t("Batch")} {(batch.batch_index ?? 0) + 1}/{batch.batches_total}
        </div>

        <div className="grid grid-cols-3 gap-[8px]">
          {tiles.map((tile) => (
            <StatTile
              key={tile.kind}
              label={tile.label}
              value={tile.value}
              color={tile.color}
              active={statusFilter === tile.kind}
              onClick={
                tile.value > 0 ? () => toggleFilter(tile.kind) : undefined
              }
            />
          ))}
        </div>

        <div>
          <div className="flex items-center justify-between mb-[8px]">
            <div className="text-[14px] text-muted-foreground">
              {statusFilter
                ? `${filteredMessages?.length ?? 0} / ${batch.recipient_count} ${t("recipients")}`
                : `${batch.recipient_count} ${t("recipients")}`}
            </div>
            {statusFilter && (
              <button
                className="text-[12px] text-primary"
                onClick={() => setStatusFilter(null)}
              >
                {t("Clear filter")}
              </button>
            )}
          </div>

          {messagesLoading && (
            <div className="flex justify-center p-4">
              <LoaderCircle className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          )}

          <div className="flex flex-col rounded-xl border border-border overflow-hidden bg-card">
            {filteredMessages?.map((m) => (
              <div
                key={m.message_id}
                className={
                  "flex items-center justify-between px-[14px] py-[10px] border-b border-border last:border-b-0 " +
                  (m.contact_id ? "cursor-pointer hover:bg-accent" : "")
                }
                onClick={() => openContact(m.contact_id)}
              >
                <span className="text-[14px]">
                  {m.contact_name || m.contact_address}
                </span>
                <span className="text-[12px] text-muted-foreground">
                  {messageStatusLabel(m.status, t, m.service)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {canCancel && (
          <Button
            className="self-start rounded-full border border-destructive/30 text-destructive px-4 py-2 text-[14px]"
            loading={cancelBatch.isPending}
            onClick={() => setConfirming(true)}
          >
            {t("Cancel this batch")}
          </Button>
        )}
      </div>

      <ConfirmModal
        open={confirming}
        title={t("Cancel this batch?")}
        confirmLabel={t("Cancel batch")}
        loading={cancelBatch.isPending}
        onConfirm={confirmCancel}
        onCancel={() => setConfirming(false)}
        body={
          <>
            <p className="text-[15px] text-foreground">
              {t(
                "This will cancel the still-pending messages in this batch.",
              )}
            </p>
            <p className="text-[13px] text-muted-foreground mt-2">
              {t("This action cannot be undone.")}
            </p>
          </>
        }
      />
    </div>
  );
}
