import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import SectionHeader from "@/components/SectionHeader";
import SectionBody from "@/components/SectionBody";
import SectionFooter from "@/components/SectionFooter";
import Button from "@/components/Button";
import { useTranslation } from "@/hooks/useTranslation";
import { useCurrentAgent } from "@/queries/useAgents";
import { getFacebookAuthorizeUrl } from "@/queries/useFacebookSignup";

export const Route = createFileRoute("/_auth/integrations/facebook/new")({
  component: FacebookNew,
});

// Where Facebook redirects back to after the user authorizes. Must match a
// redirect URI registered in the Meta app dashboard. It's a standalone route
// (not under `_auth`) so the return page is a bare "connecting" screen rather
// than the whole app shell.
export const FB_INAPP_REDIRECT_PATH = "/oauth/facebook";

function FacebookNew() {
  const { translate: t } = useTranslation();
  const { data: currentAgent } = useCurrentAgent();
  const isOwner = currentAgent?.extra?.role === "owner";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  // Plain redirect OAuth, same shape as Instagram: we redirect the whole tab so
  // the token exchange happens back in this same tab — scoped to the active org
  // — with no fragile cross-tab handoff.
  const connect = () => {
    setError(false);
    setLoading(true);

    const state = crypto.randomUUID();
    const redirect_uri = `${window.location.origin}${FB_INAPP_REDIRECT_PATH}`;
    // Read back on return to validate against CSRF.
    localStorage.setItem("fb_oauth_state", state);

    getFacebookAuthorizeUrl(redirect_uri, state)
      .then((url) => window.location.assign(url))
      .catch(() => {
        setLoading(false);
        setError(true);
      });
  };

  return (
    <>
      <SectionHeader title={t("Connect Facebook Page")} />

      <SectionBody>
        <div className="instructions">
          <p>
            {t(
              "Connect a Facebook Page to import its Lead Ads Instant Form submissions as contacts automatically.",
            )}
          </p>
          <ul>
            <li>
              {t(
                "Leads from ads shown on Instagram are included — they belong to the same Facebook Page.",
              )}
            </li>
            <li>
              {t(
                "You must be able to advertise on the Page. Pages without that permission will not appear in the list.",
              )}
            </li>
            <li>
              {t(
                "Leads from the last 90 days are imported on connect. Meta does not retain leads older than that.",
              )}
            </li>
            {/* Leads Access Manager is the most common reason a connection
                succeeds but no leads ever arrive. */}
            <li>
              {t(
                "If your business uses Leads Access Manager, grant this app lead access there as well.",
              )}
            </li>
          </ul>
          {error && (
            <p className="text-destructive font-medium">
              {t("The Facebook Page could not be connected.")}
            </p>
          )}
        </div>
      </SectionBody>

      <SectionFooter>
        <Button
          loading={loading}
          disabled={!isOwner}
          disabledReason={t("Requires owner permissions")}
          className="primary bg-[#1877F2] hover:bg-[#1877F2]/90 text-white w-full"
          onClick={connect}
        >
          {t("Continue with Facebook")}
        </Button>
      </SectionFooter>
    </>
  );
}
