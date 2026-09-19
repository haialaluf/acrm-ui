import { createFileRoute } from "@tanstack/react-router";
import SectionBody from "@/components/SectionBody";
import SectionHeader from "@/components/SectionHeader";
import { useTranslation } from "@/hooks/useTranslation";
import { useState } from "react";
import { Check, Copy } from "lucide-react";

export const Route = createFileRoute("/_auth/settings/connect-claude")({
  component: ConnectClaude,
});

// One fixed URL for every customer — identity comes from the OAuth login (or
// an API key), not from anything embedded in the URL, so it never changes
// per org and there is nothing to regenerate if org membership changes.
const MCP_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mcp/operator`;
const CLI_COMMAND = `claude mcp add --transport http acrm ${MCP_URL}`;

function ConnectClaude() {
  const { translate: t } = useTranslation();
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedCommand, setCopiedCommand] = useState(false);

  function copy(value: string, setCopied: (value: boolean) => void) {
    void navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <SectionHeader title={t("Connect Claude")} />

      <SectionBody className="gap-6">
        <p className="text-[13px] text-muted-foreground">
          {t(
            "Connect Claude to your ACRM account so you can ask it to do things in your CRM directly from a conversation. You'll log in with your ACRM account, the same way you log in here.",
          )}
        </p>

        <div className="flex flex-col gap-[8px]">
          <div className="label">{t("Server URL")}</div>
          <div className="flex items-center gap-2 rounded-[10px] border border-border bg-card px-3 py-[10px] w-full">
            <span className="text-[13px] truncate grow font-mono" dir="ltr">
              {MCP_URL}
            </span>
            <button
              type="button"
              className="p-[8px] hover:bg-muted rounded-full shrink-0"
              title={t("Copy URL")}
              onClick={() => copy(MCP_URL, setCopiedUrl)}
            >
              {copiedUrl ? (
                <Check className="w-[16px] h-[16px] text-primary" />
              ) : (
                <Copy className="w-[16px] h-[16px] text-muted-foreground" />
              )}
            </button>
          </div>
          <p className="text-[13px] text-muted-foreground">
            {t(
              "In claude.ai or Claude Desktop: Settings → Connectors → Add custom connector, and paste this URL.",
            )}
          </p>
        </div>

        <div className="flex flex-col gap-[8px]">
          <div className="label">{t("Claude Code")}</div>
          <div className="flex items-center gap-2 rounded-[10px] border border-border bg-card px-3 py-[10px] w-full">
            <span className="text-[13px] truncate grow font-mono" dir="ltr">
              {CLI_COMMAND}
            </span>
            <button
              type="button"
              className="p-[8px] hover:bg-muted rounded-full shrink-0"
              title={t("Copy command")}
              onClick={() => copy(CLI_COMMAND, setCopiedCommand)}
            >
              {copiedCommand ? (
                <Check className="w-[16px] h-[16px] text-primary" />
              ) : (
                <Copy className="w-[16px] h-[16px] text-muted-foreground" />
              )}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-[8px]">
          <div className="label">{t("What Claude can do today")}</div>
          <ul className="list-disc pl-[20px] text-[13px] text-muted-foreground flex flex-col gap-[4px]">
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
                "Check how your channels are doing — quality rating, messaging limits, sending reputation",
              )}
            </li>
            <li>
              {t(
                "Manage your team, organization settings, connected channels, webhooks and API keys",
              )}
            </li>
            <li>
              {t(
                "If you're part of more than one organization, ask which organizations you belong to and switch between them",
              )}
            </li>
          </ul>
        </div>

        <div className="flex flex-col gap-[8px]">
          <div className="label">{t("Ready-made workflows")}</div>
          <p className="text-[13px] text-muted-foreground">
            {t(
              "These you start by name — type them in Claude Code, or pick them from the + menu in Claude Desktop. Claude won't offer them on its own, so it is worth knowing they are there.",
            )}
          </p>
          <ul className="list-disc pl-[20px] text-[13px] text-muted-foreground flex flex-col gap-[4px]">
            <li>
              <code className="font-mono" dir="ltr">
                setup_agent
              </code>{" "}
              —{" "}
              {t(
                "configure an AI agent end to end, stopping before it goes live",
              )}
            </li>
            <li>
              <code className="font-mono" dir="ltr">
                audit_agent
              </code>{" "}
              — {t("review an agent you already have and get concrete fixes")}
            </li>
            <li>
              <code className="font-mono" dir="ltr">
                diagnose_delivery
              </code>{" "}
              — {t("work out why messages aren't going out")}
            </li>
            <li>
              <code className="font-mono" dir="ltr">
                weekly_summary
              </code>{" "}
              — {t("a recap of conversations, channel health and broadcasts")}
            </li>
            <li>
              <code className="font-mono" dir="ltr">
                draft_broadcast
              </code>{" "}
              — {t("scope an audience, count it, and draft the message")}
            </li>
          </ul>
        </div>

        <p className="text-[13px] text-muted-foreground">
          {t("Prefer an API key instead of logging in? Use your")}{" "}
          <a href="/settings/api-keys" className="underline">
            {t("API Keys")}
          </a>{" "}
          {t("page instead — send it as the")}{" "}
          <code className="font-mono">api-key</code> {t("header.")}
        </p>
      </SectionBody>
    </>
  );
}
