import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import SectionBody from "@/components/SectionBody";
import SectionHeader from "@/components/SectionHeader";
import { useTranslation } from "@/hooks/useTranslation";

export const Route = createFileRoute("/_auth/settings/connect-chatgpt")({
  component: ConnectChatGPT,
});

// The same operator endpoint serves Claude and ChatGPT. OAuth identifies the user.
const MCP_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mcp/operator`;

function ConnectChatGPT() {
  const { translate: t } = useTranslation();
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">(
    "idle",
  );

  useEffect(() => {
    if (copyStatus !== "copied") return;
    const timeout = window.setTimeout(() => setCopyStatus("idle"), 2000);
    return () => window.clearTimeout(timeout);
  }, [copyStatus]);

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(MCP_URL);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("error");
    }
  }

  return (
    <>
      <SectionHeader title={t("Connect ChatGPT")} />

      <SectionBody className="gap-6">
        <p className="text-[13px] text-muted-foreground">
          {t(
            "Connect ChatGPT to your DelaCRM account to work with your contacts, conversations and appointments from a chat. Sign in with the same account you use here. You can keep Claude and ChatGPT connected at the same time.",
          )}
        </p>

        <div className="flex flex-col gap-[8px]">
          <div className="label">{t("Server URL")}</div>
          <div className="flex items-center gap-2 rounded-[10px] border border-border bg-card px-3 py-[10px] w-full">
            <span
              className="text-[13px] break-all min-w-0 grow font-mono select-all"
              dir="ltr"
            >
              {MCP_URL}
            </span>
            <button
              type="button"
              className="p-[8px] hover:bg-muted rounded-full shrink-0"
              title={t("Copy URL")}
              aria-label={t("Copy URL")}
              onClick={copyUrl}
            >
              {copyStatus === "copied" ? (
                <Check className="w-[16px] h-[16px] text-primary" />
              ) : (
                <Copy className="w-[16px] h-[16px] text-muted-foreground" />
              )}
            </button>
          </div>
          <p className="text-[13px] text-muted-foreground" role="status">
            {copyStatus === "copied"
              ? t("URL copied")
              : copyStatus === "error"
                ? t("Could not copy the URL. Select and copy it manually.")
                : null}
          </p>
        </div>

        <div className="flex flex-col gap-[8px]">
          <div className="label">{t("Set up in ChatGPT")}</div>
          <a
            href="https://chatgpt.com/plugins"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-[13px] underline self-start"
          >
            {t("Open ChatGPT Plugins")}
            <ExternalLink className="w-[16px] h-[16px]" />
          </a>
          <ol className="list-decimal ps-[20px] text-[13px] text-muted-foreground flex flex-col gap-[8px]">
            <li>
              {t(
                "In ChatGPT on the web, open Plugins → Add → Create custom MCP server.",
              )}
            </li>
            <li>{t("Enter DelaCRM as the name.")}</li>
            <li>
              {t(
                "Choose Server URL, paste the URL above, and select OAuth for authentication.",
              )}
            </li>
            <li>
              {t(
                "Review the acknowledgement, check the box, and select Create as a plugin.",
              )}
            </li>
            <li>
              {t(
                "Sign in to DelaCRM and approve the connection when prompted.",
              )}
            </li>
            <li>{t("Open the DelaCRM plugin and select Try in chat.")}</li>
          </ol>
          <p className="text-[13px] text-muted-foreground">
            {t(
              "If Create custom MCP server is unavailable, check whether developer mode is available in your ChatGPT settings. Workspace accounts may need an administrator to enable custom integrations.",
            )}
          </p>
        </div>

        <div className="flex flex-col gap-[8px]">
          <div className="label">{t("Try your connection")}</div>
          <p className="text-[13px] text-muted-foreground">
            {t(
              "Ask ChatGPT: Show me my latest five contacts in DelaCRM without changing anything.",
            )}
          </p>
        </div>

        <div className="flex flex-col gap-[8px]">
          <div className="label">{t("What ChatGPT can help with")}</div>
          <ul className="list-disc ps-[20px] text-[13px] text-muted-foreground flex flex-col gap-[4px]">
            <li>
              {t(
                "Read and search your conversations, contacts and appointments, and reply in an open thread",
              )}
            </li>
            <li>
              {t(
                "Write and publish WhatsApp and email templates, then send a broadcast to a segment you describe",
              )}
            </li>
            <li>
              {t(
                "Set up and review your AI agents and automations, and book into your calendars",
              )}
            </li>
            <li>
              {t(
                "If you're part of more than one organization, ask which organizations you belong to and switch between them",
              )}
            </li>
          </ul>
        </div>
      </SectionBody>
    </>
  );
}
