import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import SectionHeader from "@/components/SectionHeader";
import SectionBody from "@/components/SectionBody";
import SectionFooter from "@/components/SectionFooter";
import WhatsAppIntegration from "@/components/WhatsAppIntegration";
import { useTranslation } from "@/hooks/useTranslation";

export const Route = createFileRoute("/_auth/integrations/whatsapp/new")({
  component: WhatsAppNew,
});

function WhatsAppNew() {
  const { translate: t } = useTranslation();
  const navigate = useNavigate();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [callbackUrl, setCallbackUrl] = useState("");
  const [verifyToken, setVerifyToken] = useState("");

  const handleSuccess = (phone_number_id: string) => {
    navigate({
      to: "/integrations/whatsapp/$orgAddressId",
      params: { orgAddressId: phone_number_id },
      hash: (prevHash) => prevHash!,
    });
  };

  return (
    <>
      <SectionHeader title={t("Connect WhatsApp")} />

      <SectionBody>
        <form>
          <div className="instructions">
            <p>
              {t(
                "To connect WhatsApp to the platform, sign in to your Meta account and follow the registration process.",
              )}
            </p>

            <p>
              <strong>{t("Important requirements")}</strong>
            </p>
            <ul>
              <li>
                {t(
                  "If you use the WhatsApp Business app, you can connect your current number and continue using the app.",
                )}
              </li>
              <li>
                {t(
                  "If you don't use the app, the number to connect must not be active on another WhatsApp account.",
                )}
              </li>
            </ul>
          </div>

          <button
            type="button"
            className="text-primary text-sm font-medium cursor-pointer self-start"
            onClick={() => setShowAdvanced((v) => !v)}
          >
            {showAdvanced
              ? t("Hide advanced options")
              : t("Advanced options")}
          </button>

          {showAdvanced && (
            <>
              <div className="instructions">
                <p>
                  {t(
                    "Overriding the callback URL is useful to bypass DelaCRM and receive the raw webhooks at the endpoint you specify. Acrm will still receive account and template events (they can't be redirected), but won't receive the messages.",
                  )}
                </p>
              </div>

              <label>
                <div className="label">
                  {t("Callback URL")} ({t("optional")})
                </div>
                <input
                  type="url"
                  className="text"
                  placeholder="https://example.com/webhook"
                  value={callbackUrl}
                  onChange={(e) => setCallbackUrl(e.target.value)}
                />
              </label>

              <label>
                <div className="label">
                  {t("Verify token")} ({t("optional")})
                </div>
                <input
                  type="text"
                  className="text"
                  value={verifyToken}
                  onChange={(e) => setVerifyToken(e.target.value)}
                />
              </label>
            </>
          )}
        </form>
      </SectionBody>

      <SectionFooter>
        <WhatsAppIntegration
          onSuccess={handleSuccess}
          signupOptions={{
            callback_url: callbackUrl.trim() || undefined,
            verify_token: verifyToken.trim() || undefined,
          }}
        />
      </SectionFooter>
    </>
  );
}
