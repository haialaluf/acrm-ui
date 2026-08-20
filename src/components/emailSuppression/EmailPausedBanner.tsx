import { useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ShieldX } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useIntegrations } from "@/hooks/useIntegrations";
import { useEmailHealthSnapshots } from "@/queries/useEmailHealth";
import {
  coalesceEmailHealth,
  isBlocked,
} from "@/components/stats/health/email/emailHealthState";

/**
 * Says out loud that Amazon SES has stopped delivering this account's email.
 *
 * Worth a banner rather than a line on the health page because of how this
 * failure presents: a paused tenant does not reject the API call, it accepts
 * every message and delivers none of them. Without this, composing a broadcast
 * and watching it complete "successfully" is indistinguishable from a working
 * account — which is exactly what happened before anything read SendingStatus.
 *
 * Renders nothing in the normal case, so it is safe to mount anywhere sending
 * is about to happen.
 */
export default function EmailPausedBanner() {
  const { translate: t } = useTranslation();
  const navigate = useNavigate();
  const { rows } = useIntegrations();
  const domain = rows.email?.address ?? null;

  const { data: snapshots } = useEmailHealthSnapshots(domain);
  const state = useMemo(
    () => coalesceEmailHealth(snapshots ?? []),
    [snapshots],
  );

  if (!isBlocked(state)) return null;

  return (
    <div className="rounded-[12px] border border-destructive/40 bg-destructive/10 p-[14px] flex items-start gap-[10px]">
      <ShieldX className="w-[18px] h-[18px] text-destructive-strong shrink-0 mt-[1px]" />
      <div className="min-w-0">
        <div className="text-[13.5px] font-semibold text-destructive-strong">
          {t("Amazon SES has paused your email sending")}
        </div>
        <div className="text-[12.5px] text-muted-foreground mt-[2px] leading-relaxed">
          {t(
            "Emails will be accepted but not delivered until this is resolved.",
          )}{" "}
          <button
            type="button"
            onClick={() =>
              navigate({ to: "/stats/email", hash: (prev) => prev! })
            }
            className="text-primary bg-transparent border-none cursor-pointer p-0 underline"
          >
            {t("See why")}
          </button>
        </div>
      </div>
    </div>
  );
}
