import { useMemo, useState } from "react";
import { LoaderCircle, Undo2 } from "lucide-react";
import ConfirmModal from "@/components/ConfirmModal";
import { useTranslation } from "@/hooks/useTranslation";
import {
  useSuppressedAddresses,
  useUnsuppressAddress,
} from "@/queries/useEmailHealth";
import { Chip, FilterPill, Ltr } from "@/components/stats/health/primitives";
import {
  suppressionReason,
  type SuppressionKind,
} from "@/components/stats/health/email/suppressionReason";

const FILTERS: { key: SuppressionKind | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "complaint", label: "Spam reports" },
  { key: "hard_bounce", label: "Invalid" },
  { key: "unsubscribed", label: "Unsubscribed" },
];

/**
 * Everyone this organization may no longer email, and why.
 *
 * Until this existed, `contacts_addresses.status = 'removed'` was written by
 * three separate paths and surfaced in exactly one place — a greyed-out row in
 * the bulk-send wizard — so there was no way to answer "who did we stop
 * mailing, and was it because they complained?".
 *
 * The un-suppress action is deliberately gated and deliberately noisy. Putting
 * back an address that hard-bounced means mailing an address that does not
 * exist; putting back one that reported spam is how a sending domain gets
 * paused. It is a legitimate thing to want (someone fixed a typo'd address,
 * a colleague clicked unsubscribe by accident) and a bad thing to do casually.
 */
export default function SuppressionList({ isOwner }: { isOwner: boolean }) {
  const { translate: t } = useTranslation();
  const [filter, setFilter] = useState<SuppressionKind | "all">("all");
  const [confirming, setConfirming] = useState<string | null>(null);

  const { data: rows, isLoading } = useSuppressedAddresses();
  const unsuppress = useUnsuppressAddress();

  const decorated = useMemo(
    () => (rows ?? []).map((row) => ({ row, reason: suppressionReason(row) })),
    [rows],
  );

  const visible = decorated.filter(
    ({ reason }) => filter === "all" || reason.kind === filter,
  );

  const confirmingReason = decorated.find(
    ({ row }) => row.address === confirming,
  )?.reason;

  return (
    <section className="flex flex-col gap-[12px]">
      <div>
        <h3 className="text-[16px] font-medium m-0">
          {t("Blocked recipients")}
        </h3>
        <p className="text-[13px] text-muted-foreground mt-[4px] mb-0 leading-relaxed">
          {t(
            "These addresses are skipped on every send. Amazon SES blocks them too, so re-enabling one here also releases it there.",
          )}
        </p>
      </div>

      <div className="flex gap-[6px] flex-wrap">
        {FILTERS.map((f) => (
          <FilterPill
            key={f.key}
            label={t(f.label)}
            active={filter === f.key}
            onClick={() => setFilter(f.key)}
          />
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center p-[24px]">
          <LoaderCircle className="w-[20px] h-[20px] animate-spin text-muted-foreground" />
        </div>
      ) : !visible.length ? (
        <p className="text-[13px] text-muted-foreground py-[8px] m-0">
          {filter === "all"
            ? t("Nobody has unsubscribed, bounced or reported your email yet.")
            : t("No addresses in this category.")}
        </p>
      ) : (
        <div className="flex flex-col rounded-xl border border-border overflow-hidden bg-card">
          {visible.map(({ row, reason }) => (
            <div
              key={row.address}
              className="flex items-center gap-[12px] px-[14px] py-[10px] border-b border-border last:border-b-0"
            >
              <div className="min-w-0 grow">
                {/* An address must not be bidi-reordered in an RTL layout. */}
                <Ltr className="text-[13.5px] truncate max-w-full">
                  {row.address}
                </Ltr>
                <div className="flex items-center gap-[8px] mt-[3px] flex-wrap">
                  <Chip tone={reason.tone}>{t(reason.label)}</Chip>
                  {reason.at && (
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(reason.at).toLocaleDateString(undefined, {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                title={
                  isOwner ? t("Re-enable") : t("Requires owner permissions")
                }
                disabled={!isOwner || unsuppress.isPending}
                onClick={() => setConfirming(row.address)}
                className="shrink-0 p-[8px] rounded-full bg-transparent border-none cursor-pointer text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Undo2 className="w-[16px] h-[16px]" />
              </button>
            </div>
          ))}
        </div>
      )}

      {unsuppress.error && (
        <p className="text-destructive font-medium text-[13px] m-0">
          {unsuppress.error.message}
        </p>
      )}

      {confirming && (
        <ConfirmModal
          open
          title={t("Re-enable this address?")}
          body={
            // The warning is specific to why they were blocked, because the
            // three reasons carry very different risk. A generic "are you
            // sure?" would flatten a spam complaint into an unsubscribe.
            confirmingReason?.kind === "complaint"
              ? t(
                  "This person reported your email as spam. Emailing them again risks getting your sending domain paused by Amazon SES.",
                )
              : confirmingReason?.kind === "hard_bounce"
                ? t(
                    "This address does not exist. Sending to it again will bounce and count against your bounce rate.",
                  )
                : t(
                    "This person asked not to receive email from you. Only re-enable this if they have asked to be added back.",
                  )
          }
          confirmLabel={t("Re-enable")}
          loading={unsuppress.isPending}
          onConfirm={() =>
            unsuppress.mutate(confirming, {
              onSuccess: () => setConfirming(null),
            })
          }
          onCancel={() => setConfirming(null)}
        />
      )}
    </section>
  );
}
