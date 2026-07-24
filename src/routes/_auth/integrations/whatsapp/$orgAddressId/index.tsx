import SectionBody from "@/components/SectionBody";
import SectionHeader from "@/components/SectionHeader";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useOrganizationAddress } from "@/queries/useOrganizationsAddresses";
import { useWhatsAppDisconnect } from "@/queries/useWhatsAppSignup";
import { useTranslation } from "@/hooks/useTranslation";
import { useCurrentAgent } from "@/queries/useAgents";
import { formatPhoneNumber } from "@/utils/FormatUtils";
import type { WhatsAppOrganizationAddressExtra } from "@/supabase/client";
import { useState } from "react";
import Button from "@/components/Button";
import SectionItem from "@/components/SectionItem";
import { LayoutTemplate } from "lucide-react";

export const Route = createFileRoute(
  "/_auth/integrations/whatsapp/$orgAddressId/",
)({
  component: WhatsAppDetails,
});

function WhatsAppDetails() {
  const { orgAddressId } = Route.useParams();
  const { translate: t } = useTranslation();
  const navigate = useNavigate();
  const { data: integration } = useOrganizationAddress(orgAddressId);
  const disconnect = useWhatsAppDisconnect();
  const { data: agent } = useCurrentAgent();
  const [showInstructions, setShowInstructions] = useState(false);

  if (!integration) return;

  const isOwner = agent?.extra?.role === "owner";

  const extra = integration.extra as
    | WhatsAppOrganizationAddressExtra
    | undefined;
  const flowType = extra?.flow_type;
  const isCoexistence = flowType === "existing_phone_number";

  const flowTypeLabels: Record<string, string> = {
    new_phone_number: t("New WhatsApp number"),
    existing_phone_number: t("Existing WhatsApp Business account"),
    only_waba: t("WABA only"),
  };

  const handleDisconnect = () => {
    if (isCoexistence) {
      setShowInstructions(true);
      return;
    }

    disconnect.mutate(
      { phone_number_id: integration.address },
      {
        onSuccess: () => {
          navigate({ to: "/integrations/whatsapp" });
        },
      },
    );
  };

  return (
    <>
      <SectionHeader title={extra?.verified_name || t("WhatsApp account")} />

      <SectionBody className="pb-[40px]">
        <SectionItem
          title={t("Message templates")}
          aside={
            <div className="p-[8px]">
              <LayoutTemplate className="w-[24px] h-[24px] text-muted-foreground" />
            </div>
          }
          onClick={() =>
            navigate({
              to: "/integrations/whatsapp/$orgAddressId/templates",
              params: { orgAddressId },
              hash: (prevHash) => prevHash!,
            })
          }
        />
        <form>
          <label>
            <div className="label">{t("Verified name")}</div>
            <input
              type="text"
              className="text"
              value={extra?.verified_name || t("No name")}
              readOnly
            />
          </label>

          <label>
            <div className="label">{t("Phone number")}</div>
            <input
              type="tel"
              className="text"
              value={formatPhoneNumber(extra?.phone_number || "")}
              readOnly
            />
          </label>

          <label>
            <div className="label">{t("Integration type")}</div>
            <input
              type="text"
              className="text"
              value={flowType ? flowTypeLabels[flowType] || flowType : ""}
              readOnly
            />
          </label>

          <label>
            <div className="label">{t("Number ID")}</div>
            <input
              type="text"
              className="text"
              value={integration.address}
              readOnly
            />
          </label>

          <label>
            <div className="label">{t("WABA ID")}</div>
            <input
              type="text"
              className="text"
              value={extra?.waba_id}
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

          {extra?.access_token && (
            <label>
              <div className="label">{t("WABA access token")}</div>
              <input
                type="text"
                className="text font-mono text-xs"
                value={extra.access_token}
                readOnly
              />
            </label>
          )}

          <div className="instructions">
            <p>
              {t(
                "Overriding the callback URL is useful to bypass Acrm and receive the raw webhooks at the endpoint you specify. DelaCRM will still receive account and template events (they can't be redirected), but won't receive the messages.",
              )}
            </p>
          </div>

          <label>
            <div className="label">{t("Callback URL")}</div>
            <input
              type="text"
              className="text"
              value={extra?.callback_url || ""}
              placeholder={t("Not overridden")}
              readOnly
            />
          </label>

          <label>
            <div className="label">{t("Verify token")}</div>
            <input
              type="text"
              className="text"
              value={extra?.verify_token || ""}
              placeholder={t("Not overridden")}
              readOnly
            />
          </label>

          {/* Disconnect button */}
          {integration.status === "connected" && !showInstructions && (
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

          {/* Coexistence disconnect instructions */}
          {showInstructions && (
            <div className="instructions">
              <p>
                {t(
                  "The account must be unlinked from the WhatsApp Business mobile app:",
                )}
              </p>
              <ol>
                <li>{t("Open the WhatsApp Business app")}</li>
                <li>{t("Go to Settings > Account > Business Platform")}</li>
                <li>
                  {t("Tap the connected platform and select \"Disconnect\"")}
                </li>
              </ol>
            </div>
          )}
        </form>
      </SectionBody>
    </>
  );
}
