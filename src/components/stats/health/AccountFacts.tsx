import { useTranslation } from "@/hooks/useTranslation";
import {
  formatTier,
  humanizeEnum,
  nextPollAt,
  toneFor,
  type AccountHealthState,
} from "./healthState";
import { Card, CardHead, Chip, Ltr, TONE, formatNumber } from "./primitives";

const time = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

const date = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
      })
    : "—";

/** The raw account facts behind the hero, for when someone needs the details. */
export default function AccountFacts({
  state,
}: {
  state: AccountHealthState | null;
}) {
  const { translate: t } = useTranslation();

  if (!state) return null;

  const rows: {
    label: string;
    value?: string;
    status?: string | null;
    ltr?: boolean;
  }[] = [
    { label: t("WABA id"), value: state.wabaId ?? "—", ltr: true },
    ...(state.displayName
      ? [{ label: t("Display name"), value: state.displayName }]
      : []),
    { label: t("Name status"), status: state.nameStatus },
    { label: t("Account review"), status: state.accountReviewStatus },
    {
      label: t("Business verification"),
      status: state.businessVerificationStatus,
    },
    {
      label: t("Messaging tier"),
      value: state.messagingLimit
        ? `${state.messagingLimitTier ? `${formatTier(state.messagingLimitTier)} · ` : ""}${formatNumber(state.messagingLimit)}/${t("day")}`
        : formatTier(state.messagingLimitTier),
    },
    {
      label: t("Policy violation"),
      value: state.violationType
        ? `${state.violationType}${state.violationAt ? ` · ${date(state.violationAt)}` : ""}`
        : t("None"),
    },
  ];

  return (
    <Card>
      <CardHead
        title={t("Account")}
        note={
          state.lastCheckedAt
            ? `${t("Checked")} ${time(state.lastCheckedAt)}`
            : undefined
        }
      />
      <div className="flex flex-col">
        {rows.map((row, i) => (
          <div
            key={row.label}
            className={`flex items-center justify-between gap-[12px] py-[9px] ${i ? "border-t border-border" : ""}`}
          >
            <span className="text-[12px] text-muted-foreground shrink-0">
              {row.label}
            </span>
            {row.status !== undefined ? (
              row.status ? (
                <Chip tone={toneFor(row.status)} dot>
                  {humanizeEnum(row.status)}
                </Chip>
              ) : (
                <span className="text-[12.5px] text-muted-foreground">—</span>
              )
            ) : row.ltr ? (
              <Ltr className="text-[12.5px] tabular-nums truncate">
                {row.value}
              </Ltr>
            ) : (
              <span className="text-[12.5px] text-end">{row.value}</span>
            )}
          </div>
        ))}
      </div>

      {state.restrictions.length > 0 && (
        <div
          className={`mt-[12px] rounded-[10px] p-[12px] ${TONE.destructive.tint}`}
        >
          {state.restrictions.map((r) => (
            <div
              key={r.type}
              className="text-[12.5px] leading-snug text-destructive-strong"
            >
              {r.type}
              {r.expiration
                ? ` · ${t("until")} ${date(r.expiration)}`
                : ` · ${t("no end date")}`}
            </div>
          ))}
        </div>
      )}

      <div className="text-[11px] text-muted-foreground mt-[12px] leading-snug">
        {t("Refreshed every 4 hours and on every event from Meta.")}{" "}
        {t("Next check at")} {time(nextPollAt().toISOString())}.
      </div>
    </Card>
  );
}
