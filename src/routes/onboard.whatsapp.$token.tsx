import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import Button from "@/components/Button";
import type {
  SignupMode,
  SignupPayload,
} from "@/contexts/WhatsAppIntegrationContext";

export const Route = createFileRoute("/onboard/whatsapp/$token")({
  component: Onboard,
});

type TokenValidation =
  | { status: "loading" }
  | { status: "valid"; organization_name: string }
  | { status: "invalid" }
  | { status: "success" }
  | { status: "error"; message: string };

function Onboard() {
  const { token } = Route.useParams();
  const { translate: t } = useTranslation();
  const [state, setState] = useState<TokenValidation>({ status: "loading" });
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<SignupMode>("coexistence");
  // The Facebook SDK loads asynchronously from connect.facebook.net, which is
  // commonly blocked by tracking protection / ad blockers. If it fails to load,
  // show the error up front instead of a button that cannot work.
  const [sdkFailed, setSdkFailed] = useState(
    () => !!(window as any).__fbSdkFailed,
  );

  useEffect(() => {
    const onFail = () => setSdkFailed(true);
    window.addEventListener("fb-sdk-failed", onFail);
    return () => window.removeEventListener("fb-sdk-failed", onFail);
  }, []);

  useEffect(() => {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-management/onboard?token=${token}`;
    fetch(url, {
      headers: {
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.valid) {
          setState({
            status: "valid",
            organization_name: data.organization_name,
          });
        } else {
          setState({ status: "invalid" });
        }
      })
      .catch(() => {
        setState({ status: "invalid" });
      });
  }, [token]);

  const handleSignup = useCallback(() => {
    const FB = (window as any).FB;

    if (!FB) {
      // The SDK is served from connect.facebook.net, which tracking protection
      // (e.g. Firefox ETP) and ad/privacy blockers commonly block.
      setState({
        status: "error",
        message: t(
          "Couldn't load the Facebook SDK. Disable tracking protection or your ad blocker for this site, or try another browser.",
        ),
      });
      return;
    }

    // An abandoned flow emits no finish event, so a previous attempt's session
    // info would otherwise be posted as this attempt's.
    (window as any).__waSessionInfo = undefined;

    FB.login(
      function (response: any) {
        if (response.authResponse) {
          const code = response.authResponse.code;

          if (!code) {
            return;
          }

          setLoading(true);

          const sessionInfo = (window as any).__waSessionInfo || {};

          const payload: SignupPayload = {
            code,
            application_id: import.meta.env.VITE_META_APP_ID,
            phone_number_id: sessionInfo.phone_number_id,
            waba_id: sessionInfo.waba_id,
            business_id: sessionInfo.business_id,
            flow_type: sessionInfo.flow_type,
            signup_mode: mode,
          };

          const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-management/onboard`;

          fetch(url, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ token, ...payload }),
          })
            .then(async (res) => {
              const body = await res.json().catch(() => null);

              if (!res.ok) {
                // The function answers with Meta's own reason; showing it is the
                // difference between a client fixing this themselves and a
                // support ticket.
                throw new Error(body?.error || "");
              }

              return body;
            })
            .then(() => {
              setState({ status: "success" });
            })
            .catch((error: Error) => {
              console.error("Onboard signup failed:", error);
              setState({
                status: "error",
                message:
                  error.message ||
                  t("Connection error. Try again or contact the provider."),
              });
            })
            .finally(() => {
              setLoading(false);
            });
        }
      },
      {
        config_id: import.meta.env.VITE_FB_LOGIN_CONFIG_ID,
        response_type: "code",
        override_default_response_type: true,
        extras: {
          setup: {},
          // The standard flow must NOT carry a featureType.
          ...(mode === "coexistence"
            ? { featureType: "whatsapp_business_app_onboarding" }
            : {}),
          sessionInfoVersion: "3",
        },
      },
    );
  }, [token, t, mode]);

  return (
    <div className="flex flex-col gap-9 justify-center items-center bg-background text-foreground h-dvh w-screen">
      <div className="text-primary tracking-tighter font-bold text-[36px]">
        DelaCRM
      </div>

      <div className="flex flex-col gap-4 w-[320px] max-w-[90vw] text-center">
        {state.status === "loading" && (
          <p className="text-muted-foreground">{t("Validating link...")}</p>
        )}

        {state.status === "invalid" && (
          <div className="flex flex-col gap-2">
            <p className="text-destructive font-medium">
              {t("This link is invalid or has expired.")}
            </p>
            <p className="text-muted-foreground text-[14px]">
              {t("Request a new link from your provider.")}
            </p>
          </div>
        )}

        {state.status === "valid" && (
          <div className="flex flex-col gap-4">
            <p className="text-foreground">
              {t("Connect your WhatsApp number to")}{" "}
              <strong>{state.organization_name}</strong>
            </p>

            <div className="flex flex-col gap-2 text-left text-[14px]">
              <p className="text-foreground">
                {t("Do you use the WhatsApp Business app?")}
              </p>
              {[
                {
                  value: "coexistence" as SignupMode,
                  label: t("I use the WhatsApp Business app"),
                  hint: t(
                    "Pick this even if the number is connected to another provider through the app. You keep using the app, and your chat history is imported.",
                  ),
                },
                {
                  value: "cloud_api" as SignupMode,
                  label: t("I don't use the WhatsApp Business app"),
                  hint: t(
                    "A new number, or a number that runs only on another provider's platform. Moving from another provider keeps your display name, quality rating and approved templates.",
                  ),
                },
              ].map((option) => (
                <label
                  key={option.value}
                  className="flex gap-2 items-start cursor-pointer"
                >
                  <input
                    type="radio"
                    name="whatsapp-signup-mode"
                    className="mt-1"
                    checked={mode === option.value}
                    onChange={() => setMode(option.value)}
                  />
                  <span className="flex flex-col">
                    <span className="text-foreground">{option.label}</span>
                    <span className="text-muted-foreground">{option.hint}</span>
                  </span>
                </label>
              ))}
            </div>

            <div className="instructions text-left text-[14px] text-muted-foreground">
              <p>
                {t(
                  "Sign in to your Meta account and follow the registration process.",
                )}
              </p>
              <p>
                <strong>{t("Important requirements")}</strong>
              </p>
              {mode === "coexistence" ? (
                <ul>
                  <li>
                    {t(
                      "You can keep using the WhatsApp Business app on this number.",
                    )}
                  </li>
                  <li>{t("The app must be version 2.24.17 or newer.")}</li>
                  <li>
                    {t(
                      "If the number is already connected to another provider, disconnect it first in the app: Settings > Account > Business Platform > Disconnect.",
                    )}
                  </li>
                  <li>
                    {t(
                      "Your chats can only be imported in the first 24 hours after connecting.",
                    )}
                  </li>
                </ul>
              ) : (
                <ul>
                  <li>
                    {t(
                      "A new number must not be active on any WhatsApp account.",
                    )}
                  </li>
                  <li>
                    {t(
                      "Coming from another provider: ask them to turn off two-step verification on the number.",
                    )}
                  </li>
                  <li>
                    {t(
                      "Ask them to revoke any credit line they shared with your WhatsApp Business account.",
                    )}
                  </li>
                  <li>
                    {t(
                      "Your display name must already be approved, with no pending change request.",
                    )}
                  </li>
                </ul>
              )}
            </div>

            <div className="flex flex-col gap-2">
              {sdkFailed && (
                <p className="text-destructive font-medium">
                  {t(
                    "Couldn't load the Facebook SDK. Disable tracking protection or your ad blocker for this site, or try another browser.",
                  )}
                </p>
              )}
              <Button
                disabled={sdkFailed}
                disabledReason={
                  sdkFailed
                    ? t(
                        "Couldn't load the Facebook SDK. Disable tracking protection or your ad blocker for this site, or try another browser.",
                      )
                    : undefined
                }
                loading={loading}
                className="primary bg-[#4267b2] hover:bg-[#4267b2]/90 text-white w-full"
                onClick={handleSignup}
              >
                {t("Continue with Facebook")}
              </Button>
            </div>
          </div>
        )}

        {state.status === "success" && (
          <div className="flex flex-col gap-2">
            <p className="text-primary font-medium text-[18px]">
              {t("Your WhatsApp number was connected successfully.")}
            </p>
            <p className="text-muted-foreground text-[14px]">
              {t("You can close this page.")}
            </p>
          </div>
        )}

        {state.status === "error" && (
          <div className="flex flex-col gap-3">
            <p className="text-destructive font-medium">{state.message}</p>
            <Button
              className="primary bg-[#4267b2] hover:bg-[#4267b2]/90 text-white w-full"
              onClick={() => {
                setState({
                  status: "valid",
                  organization_name: "",
                });
                // Re-validate token
                const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-management/onboard?token=${token}`;
                fetch(url, {
                  headers: {
                    Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                  },
                })
                  .then((res) => res.json())
                  .then((data) => {
                    if (data.valid) {
                      setState({
                        status: "valid",
                        organization_name: data.organization_name,
                      });
                    } else {
                      setState({ status: "invalid" });
                    }
                  })
                  .catch(() => setState({ status: "invalid" }));
              }}
            >
              {t("Retry")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
