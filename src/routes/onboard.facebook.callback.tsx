import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import Button from "@/components/Button";
import { FB_ONBOARD_REDIRECT_PATH } from "./onboard.facebook.$token";
import type { FacebookPagesResult } from "@/queries/useFacebookSignup";

export const Route = createFileRoute("/onboard/facebook/callback")({
  validateSearch: (search: Record<string, unknown>) => ({
    code: typeof search.code === "string" ? search.code : undefined,
    state: typeof search.state === "string" ? search.state : undefined,
  }),
  component: OnboardFacebookCallback,
});

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

const ANON_HEADERS = {
  Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
  "Content-Type": "application/json",
};

type State =
  | { status: "working" }
  // Unlike Instagram, the flow pauses here: a Facebook user commonly
  // administers several Pages and must pick which one to connect.
  | { status: "choosing"; result: FacebookPagesResult }
  | { status: "connecting"; result: FacebookPagesResult }
  | { status: "success"; page_name?: string }
  | { status: "error"; message?: string };

function OnboardFacebookCallback() {
  const { translate: t } = useTranslation();
  const { code, state } = Route.useSearch();
  const [result, setResult] = useState<State>({ status: "working" });
  const ran = useRef(false);

  // Leg 1 — exchange the code for the Page list. The onboarding token is not
  // consumed yet; only a successful connect marks the link used, so a customer
  // who abandons the picker can start over with the same link.
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    // `state` carries the onboarding token.
    if (!code || !state) {
      setResult({ status: "error" });
      return;
    }

    const redirect_uri = `${window.location.origin}${FB_ONBOARD_REDIRECT_PATH}`;

    fetch(`${FUNCTIONS_URL}/facebook-management/onboard/pages`, {
      method: "POST",
      headers: ANON_HEADERS,
      body: JSON.stringify({ token: state, code, redirect_uri }),
    })
      .then(async (res) => {
        const body = (await res
          .json()
          .catch(() => ({}))) as Partial<FacebookPagesResult> & {
          message?: string;
        };
        if (!res.ok) throw new Error(body.message);
        return body as FacebookPagesResult;
      })
      .then((pages) => setResult({ status: "choosing", result: pages }))
      .catch((error: Error) =>
        setResult({ status: "error", message: error.message }),
      );
  }, [code, state]);

  // Leg 2 — connect the chosen Page.
  const handleSelect = async (page_id: string) => {
    if (result.status !== "choosing") return;

    const page = result.result.pages.find((p) => p.id === page_id);
    if (!page?.access_token) return;

    setResult({ status: "connecting", result: result.result });

    try {
      const res = await fetch(`${FUNCTIONS_URL}/facebook-management/onboard`, {
        method: "POST",
        headers: ANON_HEADERS,
        body: JSON.stringify({
          token: state,
          page: {
            page_id: page.id,
            page_name: page.name,
            access_token: page.access_token,
          },
          user_access_token: result.result.user_access_token,
          fb_user_id: result.result.fb_user_id,
          user_token_expires_in: result.result.expires_in,
        }),
      });

      const body = (await res.json().catch(() => ({}))) as {
        message?: string;
      };
      if (!res.ok) throw new Error(body.message);

      setResult({ status: "success", page_name: page.name });
    } catch (error) {
      setResult({
        status: "error",
        message: error instanceof Error ? error.message : undefined,
      });
    }
  };

  return (
    <div className="flex flex-col gap-9 justify-center items-center bg-background text-foreground h-dvh w-screen">
      <div className="text-primary tracking-tighter font-bold text-[36px]">
        DelaCRM
      </div>

      <div className="flex flex-col gap-4 w-[380px] max-w-[90vw] text-center">
        {result.status === "working" && (
          <p className="text-muted-foreground">
            {t("Loading your Facebook Pages...")}
          </p>
        )}

        {(result.status === "choosing" || result.status === "connecting") && (
          <div className="flex flex-col gap-3">
            <p className="text-foreground">
              {t("Choose the Page whose leads you want to receive")}
            </p>

            <div className="flex flex-col gap-2">
              {result.result.pages.map((page) => (
                <Button
                  key={page.id}
                  disabled={result.status === "connecting"}
                  className="secondary w-full"
                  onClick={() => handleSelect(page.id)}
                >
                  {page.name ?? page.id}
                </Button>
              ))}
            </div>

            {result.status === "connecting" && (
              <p className="text-muted-foreground text-[14px]">
                {t("Connecting...")}
              </p>
            )}
          </div>
        )}

        {result.status === "success" && (
          <div className="flex flex-col gap-2">
            <p className="text-primary font-medium text-[18px]">
              {result.page_name
                ? `${result.page_name} ${t("was connected successfully.")}`
                : t("Your Facebook Page was connected successfully.")}
            </p>
            <p className="text-muted-foreground text-[14px]">
              {t(
                "New Instant Form leads will appear in your contacts automatically. Existing leads from the last 90 days are being imported now.",
              )}
            </p>
            <p className="text-muted-foreground text-[14px]">
              {t("You can close this page.")}
            </p>
          </div>
        )}

        {result.status === "error" && (
          <div className="flex flex-col gap-2">
            <p className="text-destructive font-medium">
              {t("Connection error. Try again or contact the provider.")}
            </p>
            {result.message && (
              <p className="text-muted-foreground text-[14px]">
                {result.message}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
