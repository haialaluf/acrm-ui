import { Dropdown, type MenuProps } from "antd";
import { Bot, ChevronDown, UserRound } from "lucide-react";
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
  updateConvExtra,
} from "@/utils/ConversationUtils";

/** Menu key for "follow the organization" — stored as no value at all, so it
 *  needs a key of its own that cannot be an agent id. */
const DEFAULT_KEY = "default";

/**
 * Who answers this thread: the organization's default (the first option, and
 * what every conversation starts on), one specific agent, or nobody — "None",
 * meaning a person takes it from here.
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
  const assignedAgent = selectable.find((a) => a.id === assigned);

  // An id that no longer resolves (agent deleted or since deactivated) falls
  // back to the organization, which is what agent-client does with it too.
  const selectedKey =
    assigned === NO_DEFAULT_AGENT
      ? NO_DEFAULT_AGENT
      : (assignedAgent?.id ?? DEFAULT_KEY);

  const orgDefault = organizationDefaultAgent(aiAgents, org?.extra);
  const isPaused = assistantState(conversation, org?.extra) === "paused";

  const answeredByPerson =
    selectedKey === NO_DEFAULT_AGENT ||
    (selectedKey === DEFAULT_KEY && !orgDefault);

  const select = (key: string) => {
    void updateConvExtra(conversation, {
      default_agent_id: key === DEFAULT_KEY ? null : key,
      // Choosing an agent is also how a thread comes back early from the 12h
      // pause a human reply — or a handoff — puts it in. Assigning it to a
      // person leaves the pause alone: it is already silent, and clearing it
      // would only restart the agent when the setting is undone.
      ...(key === NO_DEFAULT_AGENT ? {} : { paused: null }),
    });
  };

  const item = (key: string, label: string, hint?: string) => ({
    key,
    label: (
      <span className="flex items-center gap-[6px]">
        <span className="truncate">{label}</span>
        {hint && (
          <span className="text-[12px] text-muted-foreground truncate">
            · {hint}
          </span>
        )}
      </span>
    ),
    onClick: () => select(key),
  });

  const items: MenuProps["items"] = [
    // What "Default" resolves to is worth spelling out — it is the difference
    // between this thread being answered and not.
    item(DEFAULT_KEY, t("Default"), orgDefault?.name ?? t("No agent")),
    ...selectable.map((a) => item(a.id, a.name)),
    item(NO_DEFAULT_AGENT, t("None"), t("A person answers")),
  ];

  const label =
    selectedKey === NO_DEFAULT_AGENT
      ? t("None")
      : (assignedAgent?.name ?? t("Default"));

  return (
    <Dropdown
      trigger={["click"]}
      menu={{ items, selectable: true, selectedKeys: [selectedKey] }}
    >
      <button
        type="button"
        className="flex items-center gap-[6px] max-w-[180px] px-[10px] py-[6px] rounded-full hover:bg-muted text-muted-foreground"
        title={t("Who answers this conversation")}
      >
        {answeredByPerson ? (
          <UserRound className="w-[18px] h-[18px] shrink-0" />
        ) : (
          <Bot className="w-[18px] h-[18px] shrink-0" />
        )}
        <span className="text-[14px] truncate">{label}</span>
        {/* The agent is assigned but temporarily quiet — say so here, since
            this is also where it is brought back. */}
        {isPaused && (
          <span className="text-[12px] shrink-0">· {t("paused")}</span>
        )}
        <ChevronDown className="w-[16px] h-[16px] shrink-0" />
      </button>
    </Dropdown>
  );
}
