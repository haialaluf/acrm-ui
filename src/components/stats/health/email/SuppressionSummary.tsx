import { useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "@/hooks/useTranslation";
import { useSuppressedAddresses } from "@/queries/useEmailHealth";
import { Card, CardHead, formatNumber, TONE } from "../primitives";
import { suppressionReason, type SuppressionKind } from "./suppressionReason";

const ORDER: SuppressionKind[] = [
  "complaint",
  "hard_bounce",
  "unsubscribed",
  "other",
];

const LABEL: Record<SuppressionKind, string> = {
  complaint: "Reported as spam",
  hard_bounce: "Invalid address",
  unsubscribed: "Unsubscribed",
  other: "Removed",
};

const TONE_FOR: Record<SuppressionKind, "destructive" | "warning" | "neutral"> =
  {
    complaint: "destructive",
    hard_bounce: "warning",
    unsubscribed: "neutral",
    other: "neutral",
  };

/**
 * Who this organization may no longer email, and why.
 *
 * The counts matter more than the addresses here, because the *mix* is the
 * diagnosis: a list that is mostly unsubscribes is working as designed, one
 * that is mostly invalid addresses was not collected from real recipients, and
 * any meaningful number of spam reports is the thing that gets an account
 * paused. The full list, with the un-suppress action, lives on the email
 * integration page.
 */
export default function SuppressionSummary() {
  const { translate: t } = useTranslation();
  const navigate = useNavigate();
  const { data: rows } = useSuppressedAddresses();

  const counts = useMemo(() => {
    const tally: Record<SuppressionKind, number> = {
      complaint: 0,
      hard_bounce: 0,
      unsubscribed: 0,
      other: 0,
    };

    for (const row of rows ?? []) tally[suppressionReason(row).kind]++;

    return tally;
  }, [rows]);

  const total = (rows ?? []).length;

  return (
    <Card>
      <CardHead
        title={t("Blocked recipients")}
        note={`${formatNumber(total)} ${t("addresses")}`}
      />
      {total === 0 ? (
        <div className="text-[13px] text-muted-foreground py-[8px]">
          {t("Nobody has unsubscribed, bounced or reported your email yet.")}
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-[8px]">
            {ORDER.filter((kind) => counts[kind] > 0).map((kind) => (
              <div key={kind} className="flex items-center gap-[10px]">
                <span
                  className={`rounded-full w-[8px] h-[8px] shrink-0 ${TONE[TONE_FOR[kind]].dot}`}
                />
                <span className="text-[12.5px] grow min-w-0">
                  {t(LABEL[kind])}
                </span>
                <span className="text-[12.5px] tabular-nums shrink-0">
                  {formatNumber(counts[kind])}
                </span>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() =>
              navigate({ to: "/integrations/email", hash: (prev) => prev! })
            }
            className="text-[12px] text-primary bg-transparent border-none cursor-pointer p-0 mt-[12px]"
          >
            {t("Manage blocked recipients")}
          </button>
        </>
      )}
    </Card>
  );
}
