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
  updateConvExtra,
} from "@/utils/ConversationUtils";
import { fill } from "@/utils/fill";
import Switch from "./Switch";

/**
 * Who answers this thread, as two questions rather than one list: the switch
 * says whether an agent answers at all, and the name beside it says which one.
 *
 * "Follow the organization" is deliberately not an option here — it is the
 * state you are already in. The agent the organization resolves to is shown
 * like any other and tagged "Org default"; picking it writes nothing, so the
 * thread keeps following the organization and a later change to that setting
 * still reaches this conversation. Picking any other agent pins it.
 *
 * Written to `conversation.extra.default_agent_id` for the whole thread and
 * read back by agent-client, which resolves the same three cases in the same
 * order (see its AGENT SELECTION block).
 */
export default function ConversationAgentSelect({
  conversation,
}: {
  conversation: ConversationRow;
}) {
  const { translate: t } = useTranslation();
  const { data: agents } = useCurrentAgents();
  const { data: org } = useCurrentOrganization();

  // Turning the switch off overwrites `default_agent_id` with "none", taking
  // any pinned agent with it. Remembering it here means flicking the switch
  // back on returns the thread to the agent it actually had, instead of
  // silently dropping it to the organization's.
  const [lastPinned, setLastPinned] = useState<string | null>(null);

  // The pause countdown below is read straight off the clock, so nothing would
  // move it on its own. A minute is finer than the label's own resolution
  // everywhere except the last hour, where it is exactly right.
  const [, setTick] = useState(0);

  // Back-office and personal-assistant agents are left out along with
  // inactive ones: agent-client never lets either kind answer a contact
  // automatically (see its AGENT SELECTION block) — a personal assistant is
  // reachable only through "Chat with this agent" — so offering one here
  // would promise a reply that never comes.
  const aiAgents = (agents ?? []).filter(
    (a) => a.ai && a.kind !== "back_office" && a.kind !== "personal_assistant",
  ) as AIAgentRow[];

  // Inactive agents are left out: agent-client skips them when resolving the
  // conversation's agent, so offering one here would promise a reply that never
  // comes.
  const selectable = aiAgents.filter((a) => a.extra?.mode !== "inactive");

  const assigned = conversation.extra?.default_agent_id;
  // An id that no longer resolves (agent deleted or since deactivated) falls
  // through to the organization's agent, which is what agent-client does with
  // it too.
  const pinned = selectable.find((a) => a.id === assigned);
  const orgDefault = organizationDefaultAgent(aiAgents, org?.extra);

  const state = assistantState(conversation, org?.extra);
  const on = state !== "off";

  useEffect(() => {
    if (state !== "paused") return;

    const id = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, [state]);

  // The agent answering now, or — while the switch is off — the one that comes
  // back when it is turned on.
  const shown =
    pinned ??
    selectable.find((a) => a.id === lastPinned) ??
    orgDefault ??
    selectable[0];

  // Nothing to switch between: with no agent that could ever answer, a control
  // offering to turn one on would be lying.
  if (!shown) return null;

  // Hours until the last one, then minutes — "1h left" is a worse answer than
  // "40m left" to the only question being asked, which is whether to wait.
  const remainingMs = state === "paused" ? pauseRemainingMs(conversation) : 0;
  const pauseLabel =
    remainingMs >= 60 * 60 * 1000
      ? fill(t, "{n}h left", { n: Math.round(remainingMs / (60 * 60 * 1000)) })
      : fill(t, "{n}m left", {
          n: Math.max(1, Math.ceil(remainingMs / (60 * 1000))),
        });

  const chooseAgent = (agentId: string) => {
    setLastPinned(agentId);
    void updateConvExtra(conversation, {
      default_agent_id: agentId === orgDefault?.id ? null : agentId,
      // Choosing an agent is also how a thread comes back early from the 12h
      // pause a human reply — or a handoff — puts it in.
      paused: null,
    });
  };

  const toggle = (next: boolean) => {
    if (next) {
      chooseAgent(shown.id);
      return;
    }

    setLastPinned(shown.id);
    // The pause is left alone: the thread is already silent, and clearing it
    // would only restart the agent the moment the switch comes back on.
    void updateConvExtra(conversation, { default_agent_id: NO_DEFAULT_AGENT });
  };

  const items: MenuProps["items"] = selectable.map((a) => ({
    key: a.id,
    label: (
      <span className="flex items-center gap-[8px]">
        <span className="truncate">{a.name}</span>
        {/* Which agent the organization resolves to is worth showing: it is
            the one that keeps following the organization when picked. */}
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
    <div className="flex items-center gap-[10px] max-w-[250px] pl-[10px] pr-[12px] py-[5px] rounded-full border border-border bg-popover">
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
          <span className="truncate">{shown.name}</span>
          {/* The agent is assigned but temporarily quiet — say so here, since
              this is also where it is brought back. */}
          {state === "paused" && (
            <span className="shrink-0">· {pauseLabel}</span>
          )}
          <ChevronDown className="w-[13px] h-[13px] shrink-0" />
        </button>
      </Dropdown>
      <Switch
        className="shrink-0"
        checked={on}
        tone={state === "paused" ? "warning" : "primary"}
        onCheckedChange={toggle}
        aria-label={t("Who answers this conversation")}
      />
    </div>
  );
}
