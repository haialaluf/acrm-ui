import { Dropdown, type MenuProps } from "antd";
import { Bot, ChevronDown, Pause } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { useCurrentAgents } from "@/queries/useAgents";
import { useCurrentOrganization } from "@/queries/useOrganizations";
import {
  type AIAgentRow,
  type ConversationRow,
  NO_DEFAULT_AGENT,
} from "@/supabase/client";
import {
  assistantState,
  organizationDefaultAgent,
  pauseRemainingMs,
  pauseWindowMs,
  updateConvExtra,
} from "@/utils/ConversationUtils";
import { fill } from "@/utils/fill";
import Switch from "./Switch";

/**
 * Who answers this thread: the switch says whether an agent answers at all, the
 * name beside it says which one. Written to `conversation.extra.default_agent_id`
 * and read back by agent-client (see its AGENT SELECTION block).
 */
export default function ConversationAgentSelect({
  conversation,
}: {
  conversation: ConversationRow;
}) {
  const { translate: t } = useTranslation();
  const { data: agents } = useCurrentAgents();
  const { data: org } = useCurrentOrganization();

  // Lets a flick of the switch back on restore the agent the thread had, rather
  // than dropping it to the organization's.
  const [lastPinned, setLastPinned] = useState<string | null>(null);

  // Re-renders the pause countdown once a minute.
  const [, setTick] = useState(0);

  // Kinds agent-client never lets answer a contact automatically.
  const aiAgents = (agents ?? []).filter(
    (a) => a.ai && a.kind !== "back_office" && a.kind !== "personal_assistant",
  ) as AIAgentRow[];

  const selectable = aiAgents.filter((a) => a.extra?.mode !== "inactive");

  const assigned = conversation.extra?.default_agent_id;
  const pinned = selectable.find((a) => a.id === assigned);
  const orgDefault = organizationDefaultAgent(aiAgents, org?.extra);

  // The agent answering now, or the one that comes back when the switch is
  // turned on. Resolved before the state because the pause window is its own
  // setting.
  const shown =
    pinned ??
    selectable.find((a) => a.id === lastPinned) ??
    orgDefault ??
    selectable[0];

  const windowMs = pauseWindowMs(shown?.extra);

  // On only when agent-client would actually reply. Every reason it wouldn't —
  // "None" pinned here, automatic replies off org-wide, or the pause a human
  // reply starts — reads as off.
  const state = assistantState(conversation, org?.extra, windowMs);
  const on = state === "active";

  useEffect(() => {
    if (state !== "paused") return;

    const id = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, [state]);

  if (!shown) return null;

  const remainingMs =
    state === "paused" ? pauseRemainingMs(conversation, windowMs) : 0;
  const pauseLabel =
    remainingMs >= 60 * 60 * 1000
      ? fill(t, "{n}h left", { n: Math.round(remainingMs / (60 * 60 * 1000)) })
      : fill(t, "{n}m left", {
          n: Math.max(1, Math.ceil(remainingMs / (60 * 1000))),
        });

  const chooseAgent = (agentId: string) => {
    setLastPinned(agentId);
    void updateConvExtra(conversation, {
      // `null` keeps the thread following the organization; an id pins it.
      default_agent_id: agentId === orgDefault?.id ? null : agentId,
      paused: null,
    });
  };

  const toggle = (next: boolean) => {
    if (next) {
      chooseAgent(shown.id);
      return;
    }

    setLastPinned(shown.id);
    void updateConvExtra(conversation, { default_agent_id: NO_DEFAULT_AGENT });
  };

  const items: MenuProps["items"] = selectable.map((a) => ({
    key: a.id,
    label: (
      <span className="flex items-center gap-[8px]">
        <span className="truncate">{a.name}</span>
        {a.id === orgDefault?.id && (
          <span className="ml-auto shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
            {t("Org default")}
          </span>
        )}
      </span>
    ),
    onClick: () => chooseAgent(a.id),
  }));

  return (
    <div className="flex items-center gap-[10px] min-w-0 max-w-[250px] pl-[10px] pr-[12px] py-[5px] rounded-full border border-border bg-popover">
      <Dropdown
        trigger={["click"]}
        menu={{ items, selectable: true, selectedKeys: [shown.id] }}
      >
        <button
          type="button"
          className={`flex items-center gap-[7px] min-w-0 text-[13px] ${
            on ? "text-foreground" : "text-muted-foreground"
          }`}
          title={t("Which agent answers")}
        >
          {state === "paused" ? (
            <Pause className="w-[14px] h-[14px] shrink-0" />
          ) : (
            <Bot className="w-[14px] h-[14px] shrink-0" />
          )}
          <span className="hidden sm:inline truncate">{shown.name}</span>
          {state === "paused" && (
            <span className="hidden sm:inline shrink-0">· {pauseLabel}</span>
          )}
          <ChevronDown className="w-[13px] h-[13px] shrink-0" />
        </button>
      </Dropdown>
      <Switch
        className="shrink-0"
        checked={on}
        onCheckedChange={toggle}
        aria-label={t("Who answers this conversation")}
      />
    </div>
  );
}
