import { Calendar, Mail, Users, XCircle } from "lucide-react";
import { WhatsAppOutlined } from "@ant-design/icons";
import StatusBadge from "@/components/StatusBadge";
import { useTranslation } from "@/hooks/useTranslation";
import type { BroadcastBatchRow } from "@/queries/useBroadcasts";
import {
  batchStatus,
  batchStatusLabel,
  batchStatusTone,
  isUpcomingBatch,
} from "./batchStatus";
import { formatScheduledDate } from "./formatScheduledDate";

/**
 * One broadcast batch as a card in the left panel — the design's campaign
 * card, mapped onto this app's per-batch list model (a 5-day split send is 5
 * cards, each carrying its own "Batch i/n" pill). Replaces the plain
 * SectionItem row so the sidebar reads as a schedule rather than a chat list.
 */
export default function BroadcastCard({
  batch,
  selected,
  onOpen,
  onCancel,
}: {
  batch: BroadcastBatchRow;
  selected?: boolean;
  onOpen: () => void;
  onCancel: () => void;
}) {
  const { translate: t, currentLanguage } = useTranslation();

  const recipients = batch.recipient_count ?? 0;
  const pending = batch.pending_count ?? 0;
  const sent = batch.sent_count ?? 0;
  const delivered = batch.delivered_count ?? 0;
  const failed = batch.failed_count ?? 0;

  const status = batchStatus({
    scheduled_date: batch.scheduled_date,
    recipient_count: recipients,
    pending_count: pending,
    failed_count: failed,
    cancelled_count: batch.cancelled_count ?? 0,
  });
  const upcoming = isUpcomingBatch(status);
  // The RPC's counters are cumulative (a read message also carries sent and
  // delivered), so delivered/sent is the share of what left the door that
  // actually arrived — same ratio the design's card shows.
  const deliveredPct = sent ? Math.round((delivered / sent) * 100) : 0;
  const batchesTotal = batch.batches_total ?? 1;

  return (
    <div
      onClick={onOpen}
      className={
        "shrink-0 rounded-[14px] p-[13px] cursor-pointer border transition-colors " +
        (selected
          ? "border-primary bg-primary/8"
          : "border-border bg-background hover:bg-accent/50")
      }
    >
      {/* Title + status */}
      <div className="flex items-start justify-between gap-[8px]">
        <div className="flex items-center gap-[6px] min-w-0">
          {/* Both channels write content->>'kind' = 'template', which is what
              lets one set of queries cover them — so `service` is the only
              thing distinguishing an email campaign from a WhatsApp one here. */}
          {batch.service === "email" ? (
            <Mail
              className="w-[14px] h-[14px] shrink-0 text-muted-foreground"
              aria-label={t("Email")}
            />
          ) : (
            <WhatsAppOutlined
              style={{ fontSize: "14px" }}
              className="shrink-0 text-muted-foreground"
              aria-label={t("WhatsApp")}
            />
          )}
          <div className="text-[14px] font-semibold truncate min-w-0">
            {batch.template_name ?? t("Broadcast")}
          </div>
        </div>
        <StatusBadge
          label={batchStatusLabel(status, t)}
          tone={batchStatusTone(status)}
        />
      </div>

      {/* When it goes out, and which slice of the send this is */}
      <div className="flex items-center gap-[8px] mt-[10px] text-[12px] text-muted-foreground text-nowrap">
        <Calendar className="w-[14px] h-[14px] shrink-0" />
        <span className="text-foreground truncate">
          {formatScheduledDate(batch.scheduled_date, t, currentLanguage)}
        </span>
        {batchesTotal > 1 && (
          <span className="rounded-full px-[7px] py-[1px] bg-muted shrink-0">
            {t("Batch")} {(batch.batch_index ?? 0) + 1}/{batchesTotal}
          </span>
        )}
      </div>

      {/* Size of the batch + how it is going */}
      <div className="flex items-center justify-between gap-[8px] mt-[10px] text-[12px] text-muted-foreground">
        <span className="flex items-center gap-[6px] min-w-0">
          <Users className="w-[14px] h-[14px] shrink-0" />
          <span className="text-foreground font-semibold">{recipients}</span>
          <span className="truncate">{t("recipients")}</span>
        </span>
        <span className="text-nowrap">
          {upcoming ? (
            <>
              <span className="text-foreground font-semibold">{pending}</span>{" "}
              {t("pending")}
              {sent > 0 && ` · ${sent} ${t("sent")}`}
            </>
          ) : status === "cancelled" ? (
            t("not sent")
          ) : (
            <>
              <span className="text-foreground font-semibold">{sent}</span>{" "}
              {t("sent")} · {deliveredPct}% {t("delivered")}
            </>
          )}
        </span>
      </div>

      {/* Delivery outcome, once the batch is resolved */}
      {!upcoming && recipients > 0 && (
        <div className="flex rounded-full overflow-hidden mt-[9px] h-[4px] bg-muted">
          <div
            className="bg-success/80"
            style={{ width: `${(delivered / recipients) * 100}%` }}
          />
          <div
            className="bg-destructive"
            style={{ width: `${(failed / recipients) * 100}%` }}
          />
        </div>
      )}

      {/* Only still-pending messages can be pulled back — cancel_broadcast_batch
          no-ops on anything the dispatcher already picked up. */}
      {pending > 0 && (
        <div className="flex gap-[6px] mt-[11px] pt-[10px] border-t border-border">
          <button
            className="flex items-center gap-[5px] text-[12px] rounded-full px-[11px] py-[5px] border border-destructive/35 text-destructive hover:bg-destructive/10"
            onClick={(e) => {
              e.stopPropagation();
              onCancel();
            }}
          >
            <XCircle className="w-[12px] h-[12px]" />
            {t("Cancel this batch")}
          </button>
        </div>
      )}
    </div>
  );
}
