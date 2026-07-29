import { createFileRoute, useNavigate } from "@tanstack/react-router";
import SectionHeader from "@/components/SectionHeader";
import SectionBody from "@/components/SectionBody";
import Button from "@/components/Button";
import { useTranslation } from "@/hooks/useTranslation";
import { useOrganizationAddress } from "@/queries/useOrganizationsAddresses";
import { useFacebookDisconnect } from "@/queries/useFacebookSignup";
import { useCurrentAgent } from "@/queries/useAgents";
import type { FacebookOrganizationAddressExtra } from "@/supabase/client";

export const Route = createFileRoute(
  "/_auth/integrations/facebook/$orgAddressId/",
)({
  component: FacebookAddressDetail,
});

function FacebookAddressDetail() {
  const { translate: t } = useTranslation();
  const navigate = useNavigate();
  const { orgAddressId } = Route.useParams();
  const { data: integration } = useOrganizationAddress(orgAddressId);
  const disconnect = useFacebookDisconnect();
  const { data: agent } = useCurrentAgent();

  if (!integration) return;

  const isOwner = agent?.extra?.role === "owner";
  const extra = integration.extra as
    | FacebookOrganizationAddressExtra
    | undefined;

  const handleDisconnect = () => {
    disconnect.mutate(
      { page_id: integration.address },
      {
        onSuccess: () => navigate({ to: "/integrations/facebook" }),
      },
    );
  };

  return (
    <>
      <SectionHeader title={extra?.page_name || t("Facebook Page")} />

      <SectionBody className="pb-[40px]">
        <form>
          <label>
            <div className="label">{t("Page ID")}</div>
            <input
              type="text"
              className="text"
              value={integration.address}
              readOnly
            />
          </label>

          <label>
            <div className="label">{t("Status")}</div>
            <input
              type="text"
              className="text capitalize"
              value={
                integration.status === "connected"
                  ? t("Connected")
                  : t("Disconnected")
              }
              readOnly
            />
          </label>

          {/* Set by the per-Page /subscribed_apps call. If this is blank the
              Page is stored but Meta has nowhere to deliver leads. */}
          <label>
            <div className="label">{t("Lead notifications")}</div>
            <input
              type="text"
              className="text"
              value={
                extra?.leadgen_subscribed_at
                  ? t("Active since") +
                    " " +
                    new Date(extra.leadgen_subscribed_at).toLocaleString()
                  : t("Not subscribed")
              }
              readOnly
            />
          </label>

          {extra?.leads_synced_through && (
            <label>
              <div className="label">{t("Leads imported through")}</div>
              <input
                type="text"
                className="text"
                value={new Date(extra.leads_synced_through).toLocaleString()}
                readOnly
              />
            </label>
          )}

          {extra?.needs_reauth && (
            <div className="instructions">
              <p className="text-destructive">
                {t(
                  "The connection expired or was revoked. Reconnect the Page to keep receiving leads.",
                )}
              </p>
            </div>
          )}

          {integration.status === "connected" &&
            !extra?.leadgen_subscribed_at && (
              <div className="instructions">
                <p className="text-destructive">
                  {t(
                    "This Page is not subscribed to lead notifications. Reconnect it to fix.",
                  )}
                </p>
              </div>
            )}

          {integration.status === "connected" && (
            <Button
              type="button"
              className="primary bg-destructive text-primary-foreground hover:bg-destructive/80 px-4 py-2 rounded-full font-medium transition-colors w-fit text-[14px]"
              onClick={handleDisconnect}
              disabled={!isOwner}
              disabledReason={t("Requires owner permissions")}
              loading={disconnect.isPending}
            >
              {t("Disconnect")}
            </Button>
          )}
        </form>
      </SectionBody>
    </>
  );
}
