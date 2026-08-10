import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import SectionHeader from "@/components/SectionHeader";
import SectionBody from "@/components/SectionBody";
import SuppressionList from "@/components/emailSuppression/SuppressionList";
import Button from "@/components/Button";
import CopyButton from "@/components/CopyButton";
import StatusBadge from "@/components/StatusBadge";
import { useTranslation } from "@/hooks/useTranslation";
import { useOrganizationAddress } from "@/queries/useOrganizationsAddresses";
import {
  useCheckEmailDomain,
  useDisconnectEmailDomain,
  useSetEmailSender,
} from "@/queries/useEmailDomain";
import { useCurrentAgent } from "@/queries/useAgents";
import type {
  EmailDnsCheck,
  EmailDnsRecord,
  EmailOrganizationAddressExtra,
} from "@/supabase/client";

export const Route = createFileRoute(
  "/_auth/integrations/email/$orgAddressId/",
)({
  component: EmailDomainDetail,
});

/** Groups rendered in order, each with its own heading and explanation. */
const GROUPS: Array<{
  purposes: EmailDnsRecord["purpose"][];
  key: string;
}> = [
  { key: "dkim", purposes: ["dkim"] },
  { key: "mail_from", purposes: ["mail_from_mx", "mail_from_spf"] },
  { key: "dmarc", purposes: ["dmarc"] },
];

/** A record and its check share a name+type; that pair is the join key. */
function checkKey(record: { type: string; name: string }): string {
  return `${record.type}:${record.name}`;
}

const CHECK_TONE: Record<
  EmailDnsCheck["state"],
  "success" | "warning" | "destructive" | "neutral"
> = {
  found: "success",
  missing: "warning",
  mismatch: "destructive",
  unknown: "neutral",
};

/**
 * One labelled DNS value. The label is a fixed narrow column so Name and Value
 * line up; the value takes the rest and wraps, with the copy button pinned to
 * the right of the block rather than trailing the last wrapped line.
 */
function DnsField({
  label,
  value,
  copyTitle,
}: {
  label: string;
  value: string;
  copyTitle: string;
}) {
  return (
    <div className="flex items-start gap-[6px]">
      <span className="text-muted-foreground w-[46px] shrink-0 text-[12px] leading-[20px]">
        {label}
      </span>
      <span className="min-w-0 flex-1 font-mono break-all">{value}</span>
      <CopyButton value={value} title={copyTitle} />
    </div>
  );
}

function EmailDomainDetail() {
  const { translate: t } = useTranslation();
  const navigate = useNavigate();
  const { orgAddressId } = Route.useParams();

  // While the domain is waiting on DNS its status changes because of something
  // outside the app — SES noticing the customer's records — with no event to
  // subscribe to. Poll until it settles, then stop.
  const { data: integration } = useOrganizationAddress(orgAddressId, {
    pollWhilePending: true,
  });

  const check = useCheckEmailDomain();
  const disconnect = useDisconnectEmailDomain();
  const setSender = useSetEmailSender();
  const { data: agent } = useCurrentAgent();

  const [fromAddress, setFromAddress] = useState<string | null>(null);

  if (!integration) return;

  const isOwner = agent?.extra?.role === "owner";
  const extra = integration.extra as EmailOrganizationAddressExtra | undefined;
  const records = extra?.dns_records ?? [];
  const domain = integration.address;

  // What our resolver saw for each record on the last check. Without this the
  // page can only ever say "still pending", which reads as the button having
  // done nothing — the whole point is telling a missing record apart from a
  // mistyped one.
  const checks = new Map(
    (extra?.dns_check ?? []).map((check) => [checkKey(check), check]),
  );

  const checkLabel: Record<EmailDnsCheck["state"], string> = {
    found: t("Found"),
    missing: t("Not found yet"),
    mismatch: t("Value differs"),
    unknown: t("Could not check"),
  };

  // Only the required records gate verification, so only they drive the
  // summary: a customer who kept their own stricter _dmarc is not in error.
  const required = records.filter((record) => record.required);
  const stateOf = (record: EmailDnsRecord) =>
    checks.get(checkKey(record))?.state;
  const missing = required.filter((record) => stateOf(record) === "missing");
  const mismatched = required.filter(
    (record) => stateOf(record) === "mismatch",
  );
  const checked = required.filter((record) => stateOf(record) !== undefined);

  const summary = (() => {
    if (checked.length === 0) return null;

    if (missing.length === 0 && mismatched.length === 0) {
      return checked.every((record) => stateOf(record) === "unknown")
        ? {
            tone: "muted" as const,
            text: t(
              "We could not read your DNS just now. Verification is checked separately, so this does not block it.",
            ),
          }
        : {
            tone: "success" as const,
            text: t(
              "All required records are live. Verification usually completes within minutes.",
            ),
          };
    }

    // `translate` takes a literal string — no interpolation — so the counts sit
    // outside the translated fragments, and the clauses join on a comma rather
    // than a translated conjunction (a bare "and" has no reliable translation
    // out of context).
    const parts = [
      missing.length > 0 && `${missing.length} ${t("missing")}`,
      mismatched.length > 0 &&
        `${mismatched.length} ${t("with a different value")}`,
    ].filter(Boolean);

    return {
      tone: "warning" as const,
      text: `${parts.join(", ")}. ${t(
        "Fix them at your DNS provider, then check again.",
      )}`,
    };
  })();

  const statusLabel =
    {
      connected: t("Verified"),
      pending: t("Pending verification"),
      failed: t("Verification failed"),
      disconnected: t("Disconnected"),
    }[integration.status] ?? integration.status;

  const senderValue = fromAddress ?? extra?.default_from_address ?? "";
  const sender = senderValue.trim();

  // Only a mailbox on the verified domain can be used as the From address —
  // anything else is rejected at send time, long after this page said "Saved".
  const [senderLocal, senderDomain, ...senderRest] = sender.split("@");
  const senderValid =
    senderRest.length === 0 &&
    /^[^\s@]+$/.test(senderLocal ?? "") &&
    senderDomain?.toLowerCase() === domain.toLowerCase();

  // Nothing to complain about before the field has been touched, or while the
  // stored value is simply being displayed.
  const senderError = fromAddress !== null && sender !== "" && !senderValid;

  return (
    <>
      <SectionHeader title={domain} />

      <SectionBody className="pb-[40px]">
        <form onSubmit={(event) => event.preventDefault()}>
          <label>
            <div className="label">{t("Status")}</div>
            <input type="text" className="text" value={statusLabel} readOnly />
          </label>

          {integration.status === "pending" && (
            <div className="instructions">
              <p>
                {t(
                  "Add the records below at your DNS provider. We check automatically every few minutes — propagation can take up to 72 hours.",
                )}
              </p>
            </div>
          )}

          {integration.status === "failed" && (
            <div className="instructions">
              <p className="text-destructive font-medium">
                {extra?.verification_error === "TIMED_OUT"
                  ? t(
                      "We could not verify this domain within 72 hours. Check the records below, then disconnect and connect it again.",
                    )
                  : t(
                      "We could not verify this domain. Check that the records below match exactly.",
                    )}
              </p>
            </div>
          )}

          {integration.status === "connected" &&
            extra?.mail_from_status &&
            extra.mail_from_status !== "SUCCESS" && (
              <div className="instructions">
                <p className="text-warning font-medium">
                  {t(
                    "This domain can send, but its MAIL FROM records are not live yet. Add the MX and SPF records below so DMARC passes.",
                  )}
                </p>
              </div>
            )}

          {records.length > 0 && integration.status !== "disconnected" && (
            <div className="flex flex-col gap-[24px]">
              {GROUPS.map((group) => {
                const groupRecords = records.filter((record) =>
                  group.purposes.includes(record.purpose),
                );

                if (groupRecords.length === 0) return null;

                return (
                  <div key={group.key} className="flex flex-col gap-[8px]">
                    <div className="label">
                      {group.key === "dkim" && t("DKIM (required)")}
                      {group.key === "mail_from" && t("MAIL FROM (required)")}
                      {group.key === "dmarc" && t("DMARC (recommended)")}
                    </div>

                    <p className="text-muted-foreground text-[14px]">
                      {group.key === "dkim" &&
                        t(
                          "Proves the domain is yours and signs your messages. The domain will not verify without these.",
                        )}
                      {group.key === "mail_from" &&
                        t(
                          "Makes bounce reports come from your own domain and aligns SPF, which is what lets DMARC pass.",
                        )}
                      {group.key === "dmarc" &&
                        t(
                          "Tells receivers what to do with messages that fail authentication. If your domain already has a _dmarc record, keep it — do not replace it with this one.",
                        )}
                    </p>

                    {/* Stacked rather than a table: this page lives in the
                        app's narrow resizable panel, and a DKIM name is ~55
                        characters. Four columns of that either shred the values
                        one letter per line or push the status off-screen behind
                        a horizontal scroll — so each record gets the full width
                        and its status sits on the header line. */}
                    <div className="flex flex-col">
                      {groupRecords.map((record) => {
                        const check = checks.get(checkKey(record));

                        return (
                          <div
                            key={`${record.type}-${record.name}-${record.value}`}
                            className="border-border flex flex-col gap-[6px] border-t py-[10px] text-[14px]"
                          >
                            <div className="flex items-center justify-between gap-[8px]">
                              <span className="font-medium">
                                {record.type}
                                {record.priority !== undefined && (
                                  <span className="text-muted-foreground font-normal">
                                    {` (${t("priority")} ${record.priority})`}
                                  </span>
                                )}
                              </span>
                              {check && (
                                <span className="whitespace-nowrap">
                                  <StatusBadge
                                    label={checkLabel[check.state]}
                                    tone={CHECK_TONE[check.state]}
                                  />
                                </span>
                              )}
                            </div>

                            <DnsField
                              label={t("Name")}
                              value={record.name}
                              copyTitle={t("Copy")}
                            />
                            <DnsField
                              label={t("Value")}
                              value={record.value}
                              copyTitle={t("Copy")}
                            />

                            {/* What is actually published, so a typo is
                                fixable without leaving the page. */}
                            {check?.found?.map((value) => (
                              <p
                                key={value}
                                className="text-muted-foreground ps-[52px] font-mono text-[12px] break-all"
                              >
                                {`${t("found")}: ${value}`}
                              </p>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {summary && integration.status !== "disconnected" && (
            <p
              className={`text-[14px] font-medium ${
                {
                  success: "text-success",
                  warning: "text-warning",
                  muted: "text-muted-foreground",
                }[summary.tone]
              }`}
            >
              {summary.text}
            </p>
          )}

          {(integration.status === "pending" ||
            integration.status === "failed") && (
            <Button
              type="button"
              className="primary w-fit"
              onClick={() => check.mutate({ domain })}
              loading={check.isPending}
            >
              {t("Check now")}
            </Button>
          )}

          {integration.status === "connected" && (
            <>
              <label>
                <div className="label">{t("Default sender")}</div>
                <input
                  type="email"
                  className="text"
                  placeholder={`hola@${domain}`}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  value={senderValue}
                  onChange={(event) => setFromAddress(event.target.value)}
                  readOnly={!isOwner}
                />
              </label>
              {senderError ? (
                <p className="text-destructive text-[14px] font-medium">
                  {`${t("Enter an address on this domain, like")} hola@${domain}`}
                </p>
              ) : (
                <p className="text-muted-foreground text-[14px]">
                  {t("The address your messages will be sent from.")}
                </p>
              )}

              {setSender.error && (
                <p className="text-destructive font-medium">
                  {setSender.error.message}
                </p>
              )}

              <Button
                type="button"
                className="primary w-fit"
                disabled={!isOwner || !senderValid}
                disabledReason={
                  isOwner
                    ? `${t("Enter an address on this domain, like")} hola@${domain}`
                    : t("Requires owner permissions")
                }
                loading={setSender.isPending}
                onClick={() =>
                  setSender.mutate(
                    { domain, default_from_address: sender },
                    { onSuccess: () => setFromAddress(null) },
                  )
                }
              >
                {t("Save")}
              </Button>
            </>
          )}

          {check.error && (
            <p className="text-destructive font-medium">
              {check.error.message}
            </p>
          )}

          {extra?.last_checked_at && integration.status !== "disconnected" && (
            <p className="text-muted-foreground text-[14px]">
              {`${t("Last checked")}: ${new Date(
                extra.last_checked_at,
              ).toLocaleString()}`}
            </p>
          )}

          {integration.status !== "disconnected" && (
            <Button
              type="button"
              className="primary bg-destructive text-primary-foreground hover:bg-destructive/80 px-4 py-2 rounded-full font-medium transition-colors w-fit text-[14px]"
              onClick={() =>
                disconnect.mutate(
                  { domain },
                  { onSuccess: () => navigate({ to: "/integrations/email" }) },
                )
              }
              disabled={!isOwner}
              disabledReason={t("Requires owner permissions")}
              loading={disconnect.isPending}
            >
              {t("Disconnect")}
            </Button>
          )}
        </form>

        {/* Outside the form: this is a list with its own actions, not another
            field of the domain settings. Kept on this page rather than under
            /stats/email because acting on a blocked address is an integration
            setting, while the rates that explain them are a statistic. */}
        {integration.status !== "disconnected" && (
          <div className="mt-[32px] pt-[24px] border-t border-border">
            <SuppressionList isOwner={isOwner} />
          </div>
        )}
      </SectionBody>
    </>
  );
}
