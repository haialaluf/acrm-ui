import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import Button from "@/components/Button";
import {
  type FacebookPagesResult,
  useFacebookPages,
  useFacebookSignup,
} from "@/queries/useFacebookSignup";
import { FB_INAPP_REDIRECT_PATH } from "@/routes/_auth/integrations/facebook/new";

// Standalone (outside the `_auth` layout) so the return page is a bare
// "connecting" screen instead of the whole app shell.
export const Route = createFileRoute("/oauth/facebook")({
  validateSearch: (search: Record<string, unknown>) => ({
    code: typeof search.code === "string" ? search.code : undefined,
    state: typeof search.state === "string" ? search.state : undefined,
    // Facebook sends `error=access_denied` when the user cancels/denies.
    error: typeof search.error === "string" ? search.error : undefined,
  }),
  component: FacebookOAuthCallback,
});

function FacebookOAuthCallback() {
  const { translate: t } = useTranslation();
  const navigate = useNavigate();
  const { code, state, error } = Route.useSearch();
  const { mutate: listPages } = useFacebookPages();
  const { mutate: connect, isPending: connecting } = useFacebookSignup();
  const [pages, setPages] = useState<FacebookPagesResult | null>(null);
  const [failed, setFailed] = useState(false);
  const ran = useRef(false);

  // Leg 1 — the connect page redirected this same tab to Facebook and back, so
  // the token exchange runs here, scoped to the (persisted) active org.
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const expected = localStorage.getItem("fb_oauth_state");
    localStorage.removeItem("fb_oauth_state");

    // User canceled/denied: quietly return to the connect screen.
    if (error === "access_denied") {
      navigate({ to: "/integrations/facebook/new", hash: "" });
      return;
    }

    if (error || !code || !state || state !== expected) {
      setFailed(true);
      return;
    }

    const redirect_uri = `${window.location.origin}${FB_INAPP_REDIRECT_PATH}`;
    listPages(
      { code, redirect_uri },
      {
        onSuccess: (result) => setPages(result),
        onError: () => setFailed(true),
      },
    );
  }, [code, state, error, listPages, navigate]);

  // Leg 2 — connect the chosen Page. Instagram connects a single account and so
  // needs no picker; a Facebook user commonly administers several Pages.
  const handleSelect = (page_id: string) => {
    if (!pages) return;

    const page = pages.pages.find((p) => p.id === page_id);
    if (!page?.access_token) return;

    connect(
      {
        page: {
          page_id: page.id,
          page_name: page.name,
          access_token: page.access_token,
        },
        user_access_token: pages.user_access_token,
        fb_user_id: pages.fb_user_id,
        user_token_expires_in: pages.expires_in,
      },
      {
        onSuccess: (data: { address?: string }) =>
          navigate({
            to: "/integrations/facebook/$orgAddressId",
            params: { orgAddressId: data.address ?? "" },
            // Drop the `#_=_` artifact Facebook appends to the redirect.
            hash: "",
          }),
        onError: () => setFailed(true),
      },
    );
  };

  return (
    <div className="flex flex-col gap-9 justify-center items-center bg-background text-foreground h-dvh w-screen">
      <div className="text-primary tracking-tighter font-bold text-[36px]">
        DelaCRM
      </div>

      <div className="flex flex-col items-center gap-4 w-[380px] max-w-[90vw] text-center">
        {failed ? (
          <>
            <p className="text-destructive font-medium">
              {t("The Facebook Page could not be connected.")}
            </p>
            <button
              type="button"
              className="text-primary font-medium cursor-pointer"
              onClick={() =>
                navigate({ to: "/integrations/facebook/new", hash: "" })
              }
            >
              {t("Retry")}
            </button>
          </>
        ) : pages ? (
          <div className="flex flex-col gap-3 w-full">
            <p className="text-foreground">
              {t("Choose the Page whose leads you want to receive")}
            </p>

            <div className="flex flex-col gap-2">
              {pages.pages.map((page) => (
                <Button
                  key={page.id}
                  disabled={connecting}
                  className="secondary w-full"
                  onClick={() => handleSelect(page.id)}
                >
                  {page.name ?? page.id}
                </Button>
              ))}
            </div>

            {connecting && (
              <p className="text-muted-foreground text-[14px]">
                {t("Connecting...")}
              </p>
            )}
          </div>
        ) : (
          <p className="text-muted-foreground">
            {t("Loading your Facebook Pages...")}
          </p>
        )}
      </div>
    </div>
  );
}
