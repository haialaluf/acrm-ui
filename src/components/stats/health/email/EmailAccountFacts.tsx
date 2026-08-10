import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardHead, Chip, Ltr } from "../primitives";
import type { EmailHealthState } from "./emailHealthState";
import { toneForReputation, toneForSendingStatus } from "./emailHealthState";

const REPUTATION_LABEL: Record<string, string> = {
  none: "No findings",
  low: "Minor warning",
  high: "Serious warning",
};

const SENDING_STATUS_LABEL: Record<string, string> = {
  ENABLED: "Enabled",
  PAUSED: "Paused",
  DISABLED: "Paused",
  ENFORCED: "Paused by AWS",
  REINSTATED: "Recently reinstated",
};

/**
 * What Amazon SES currently holds on this organization's tenant.
 *
 * Every value here comes from SES rather than from our own tables, which is the
 * point: our copy of the data says what we sent, and this says what the
 * provider concluded about it.
 */
export default function EmailAccountFacts({
  state,
}: {
  state: EmailHealthState | null;
}) {
  const { translate: t } = useTranslation();

  if (!state) return null;

  return (
    <Card>
      <CardHead title={t("Amazon SES status")} />
      <dl className="grid grid-cols-2 gap-y-[12px] gap-x-[10px] m-0">
        <Fact label={t("Sending")}>
          <Chip tone={toneForSendingStatus(state.sendingStatus)} dot>
            {t(
              SENDING_STATUS_LABEL[state.sendingStatus ?? ""] ??
                state.sendingStatus ??
                "Unknown",
            )}
          </Chip>
        </Fact>
        <Fact label={t("Reputation")}>
          <Chip tone={toneForReputation(state.reputationStatus)} dot>
            {t(
              REPUTATION_LABEL[state.reputationStatus ?? ""] ??
                state.reputationStatus ??
                "Unknown",
            )}
          </Chip>
        </Fact>
        {state.suppressedCount != null && (
          <Fact label={t("Blocked addresses")}>
            <span className="text-[13px] tabular-nums">
              {state.suppressedCount.toLocaleString()}
            </span>
          </Fact>
        )}
        {state.tenantName && (
          <Fact label={t("Sender ID")}>
            {/* An AWS identifier — must not be bidi-reordered in RTL. */}
            <Ltr className="text-[11px] font-mono text-muted-foreground">
              {state.tenantName}
            </Ltr>
          </Fact>
        )}
      </dl>
    </Card>
  );
}

function Fact({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-muted-foreground mb-[3px]">{label}</dt>
      <dd className="m-0">{children}</dd>
    </div>
  );
}
