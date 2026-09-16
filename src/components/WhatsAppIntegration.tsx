import { useContext, useEffect, useState } from "react";
import {
  WhatsAppIntegrationContext,
  type SignupMode,
  type SignupOptions,
} from "@/contexts/WhatsAppIntegrationContext";
import useBoundStore from "@/stores/useBoundStore";
import Button from "@/components/Button";
import { useTranslation } from "@/hooks/useTranslation";
import { useCurrentAgent } from "@/queries/useAgents";

export default function WhatsAppIntegration({
  onSuccess,
  signupOptions,
}: {
  onSuccess?: (phone_number_id: string) => void;
  signupOptions?: SignupOptions;
}) {
  const { translate: t } = useTranslation();
  const context = useContext(WhatsAppIntegrationContext);
  const orgId = useBoundStore((state) => state.ui.activeOrgId);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<SignupMode>(
    signupOptions?.signup_mode ?? "coexistence",
  );
  const [error, setError] = useState<string | null>(null);
  const { data: agent } = useCurrentAgent();
  const isOwner = agent?.extra?.role === "owner";
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

  if (!context?.launchWhatsAppSignup) return null;

  const sdkErrorMessage = t(
    "Couldn't load the Facebook SDK. Disable tracking protection or your ad blocker for this site, or try another browser.",
  );

  const modes: { value: SignupMode; label: string; hint: string }[] = [
    {
      value: "coexistence",
      label: t("I use the WhatsApp Business app"),
      hint: t(
        "Pick this even if the number is connected to another provider through the app. You keep using the app, and your chat history is imported.",
      ),
    },
    {
      value: "cloud_api",
      label: t("I don't use the WhatsApp Business app"),
      hint: t(
        "A new number, or a number that runs only on another provider's platform. Moving from another provider keeps your display name, quality rating and approved templates.",
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        {modes.map((option) => (
          <label
            key={option.value}
            className="flex gap-2 items-start cursor-pointer text-[14px]"
          >
            <input
              type="radio"
              name="whatsapp-signup-mode"
              className="mt-1"
              checked={mode === option.value}
              onChange={() => {
                setMode(option.value);
                setError(null);
              }}
            />
            <span className="flex flex-col">
              <span className="text-foreground">{option.label}</span>
              <span className="text-muted-foreground">{option.hint}</span>
            </span>
          </label>
        ))}
      </div>

      {sdkFailed && (
        <p className="text-destructive font-medium">{sdkErrorMessage}</p>
      )}
      {error && <p className="text-destructive font-medium">{error}</p>}
      <Button
        disabled={!orgId || !isOwner || sdkFailed}
        disabledReason={
          sdkFailed
            ? sdkErrorMessage
            : !isOwner
              ? t("Requires owner permissions")
              : undefined
        }
        loading={loading}
        className="primary bg-[#4267b2] hover:bg-[#4267b2]/90 text-white w-full"
        onClick={() => {
          setError(null);
          context.launchWhatsAppSignup(
            onSuccess || (() => {}),
            setLoading,
            { ...signupOptions, signup_mode: mode },
            setError,
          );
        }}
      >
        {t("Continue with Facebook")}
      </Button>
    </div>
  );
}
