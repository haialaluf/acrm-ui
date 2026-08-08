import { createFileRoute, useNavigate } from "@tanstack/react-router";
import SectionHeader from "@/components/SectionHeader";
import SectionBody from "@/components/SectionBody";
import { useTranslation } from "@/hooks/useTranslation";
import {
  useDeleteOnboardingToken,
  useOnboardingTokens,
} from "@/queries/useOnboardingTokens";
import { useCurrentAgent } from "@/queries/useAgents";
import CopyButton from "@/components/CopyButton";

export const Route = createFileRoute(
  "/_auth/integrations/instagram/onboarding/$tokenId",
)({
  component: OnboardingTokenDetail,
});

function OnboardingTokenDetail() {
  const { translate: t } = useTranslation();
  const navigate = useNavigate();
  const { tokenId } = Route.useParams();
  const { data: tokens } = useOnboardingTokens("instagram");
  const { data: currentAgent } = useCurrentAgent();
  const deleteToken = useDeleteOnboardingToken("instagram");
  const isOwner = currentAgent?.extra?.role === "owner";

  const token = tokens?.find((tk) => tk.id === tokenId);
  const isActive =
    token &&
    token.status === "active" &&
    new Date(token.expires_at) > new Date();
  const onboardUrl = `${window.location.origin}/onboard/instagram/${tokenId}`;

  function getStatusLabel() {
    if (!token) return "";
    if (token.status === "used") return t("Used");
    if (token.status === "expired" || new Date(token.expires_at) < new Date()) {
      return t("Expired");
    }
    return t("Active");
  }

  return (
    token && (
      <>
        <SectionHeader
          title={token.name}
          onDelete={() =>
            deleteToken.mutate(tokenId, {
              onSuccess: () =>
                navigate({ to: "..", hash: (prevHash) => prevHash! }),
            })
          }
          deleteDisabled={!isOwner}
          deleteDisabledReason={t("Requires owner permissions")}
          deleteLoading={deleteToken.isPending}
        />

        <SectionBody>
          <form>
            <label>
              <div className="label">{t("Status")}</div>
              <div className="text-[16px] text-foreground">
                {getStatusLabel()}
              </div>
            </label>

            <label>
              <div className="label">{t("Expires")}</div>
              <div className="text-[16px] text-foreground">
                {new Date(token.expires_at).toLocaleString()}
              </div>
            </label>

            {token.used_at && (
              <label>
                <div className="label">{t("Used")}</div>
                <div className="text-[16px] text-foreground">
                  {new Date(token.used_at).toLocaleString()}
                </div>
              </label>
            )}

            <label>
              <div className="label">{t("Link")}</div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  className="text"
                  readOnly
                  value={onboardUrl}
                />
                {isActive && (
                  <CopyButton value={onboardUrl} title={t("Copy link")} />
                )}
              </div>
            </label>
          </form>
        </SectionBody>
      </>
    )
  );
}
