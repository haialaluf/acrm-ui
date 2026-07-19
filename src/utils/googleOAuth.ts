/**
 * Google OAuth popup flow (extracted from the former ToolsSection).
 *
 * Opens the delacrm MCP Google-auth popup for the requested product(s) and
 * resolves with the issued API key once the popup posts back an
 * `oauth-callback` message. Consumers (e.g. SkillsSection's `google_oauth`
 * config field) turn the returned `apiKey` into a `Bearer <apiKey>`
 * authorization header and persist it on the skill connection.
 */

export type GoogleOAuthResult = {
  apiKey: string;
  url?: string;
  email?: string;
  files?: string[];
};

export type GoogleOAuthProduct = "calendar" | "sheets";

export function openGoogleOAuth(
  product: GoogleOAuthProduct,
): Promise<GoogleOAuthResult> {
  return new Promise((resolve, reject) => {
    // https://mcp.delacrm.com/auth/google?products=calendar,sheets&callback=YOUR_CALLBACK_URL
    const callbackUrl = window.location.origin + "/oauth/callback";
    const authUrl = `https://mcp.delacrm.com/auth/google?products=${product}&callback=${encodeURIComponent(
      callbackUrl,
    )}`;

    // Center the popup on screen.
    const width = 600;
    const height = 700;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;

    const popup = window.open(
      authUrl,
      "google_auth_popup",
      `width=${width},height=${height},top=${top},left=${left}`,
    );

    if (!popup) {
      reject(new Error("Popup blocked"));
      return;
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      if (event.data?.type === "oauth-callback" && event.data?.apiKey) {
        window.removeEventListener("message", handleMessage);

        const files = event.data?.files
          ? typeof event.data.files === "string"
            ? (event.data.files as string).split(",")
            : []
          : undefined;

        resolve({
          apiKey: event.data.apiKey as string,
          url: event.data.url as string | undefined,
          email: event.data.email as string | undefined,
          files,
        });
      }
    };

    window.addEventListener("message", handleMessage);
  });
}
