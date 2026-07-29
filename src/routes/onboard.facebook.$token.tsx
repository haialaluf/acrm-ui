import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import Button from "@/components/Button";
import { getFacebookAuthorizeUrl } from "@/queries/useFacebookSignup";

export const Route = createFileRoute("/onboard/facebook/$token")({
  component: OnboardFacebook,
});

// Fixed public callback (must be registered in the Meta app dashboard); the
// onboarding token rides in `state`, not the path.
export const FB_ONBOARD_REDIRECT_PATH = "/onboard/facebook/callback";

type TokenValidation =
  | { status: "loading" }
  | { status: "valid"; organization_name: string }
  | { status: "invalid" };

function OnboardFacebook() {
  const { token } = Route.useParams();
  const { translate: t } = useTranslation();
  const [state, setState] = useState<TokenValidation>({ status: "loading" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/facebook-management/onboard?token=${token}`;
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
  }, [token]);

  const handleConnect = async () => {
    setLoading(true);
    try {
      const redirect_uri = `${window.location.origin}${FB_ONBOARD_REDIRECT_PATH}`;
      const url = await getFacebookAuthorizeUrl(redirect_uri, token);
      window.location.assign(url);
    } catch {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-9 justify-center items-center bg-background text-foreground h-dvh w-screen">
      <div className="text-primary tracking-tighter font-bold text-[36px]">
        DelaCRM
      </div>

      <div className="flex flex-col gap-4 w-[380px] max-w-[90vw] text-center">
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
              {t("Connect your Facebook Page to")}{" "}
              <strong>{state.organization_name}</strong>
            </p>

            <div className="instructions text-left text-[14px] text-muted-foreground flex flex-col gap-2">
              <p>
                {t(
                  "New leads from your Instant Forms will be added to your contacts automatically. Leads from ads shown on Instagram are included — they belong to the same Facebook Page.",
                )}
              </p>
              <p>
                {t(
                  "Log in with an account that can advertise on the Page, then choose the Page to connect.",
                )}
              </p>
              {/* Leads Access Manager is the single most common reason a
                  connection succeeds but no leads ever arrive: once a business
                  customizes lead access, apps must be granted it explicitly. */}
              <p>
                {t(
                  "If your business uses Leads Access Manager, grant this app lead access there as well — otherwise the connection succeeds but no leads are delivered.",
                )}
              </p>
            </div>

            <Button
              loading={loading}
              className="primary bg-[#1877F2] hover:bg-[#1877F2]/90 text-white w-full"
              onClick={handleConnect}
            >
              {t("Continue with Facebook")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
