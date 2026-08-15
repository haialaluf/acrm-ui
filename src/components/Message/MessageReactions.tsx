import { Tooltip } from "antd";
import { useAgent } from "@/queries/useAgents";
import { useTranslation } from "@/hooks/useTranslation";
import type { Reaction } from "@/utils/reactions";

const chipClasses =
  "flex items-center gap-[3px] rounded-full bg-background border border-border shadow-sm px-[6px] py-[1px] text-[12px] leading-[16px] select-none";

/** One emoji and everyone who used it — WhatsApp shows "❤️ 2", not "❤️ ❤️". */
type ReactionGroup = {
  emoji: string;
  count: number;
  /** Set when the organization is one of the reactors: its chip toggles off. */
  agentId: string | null;
  mine: boolean;
  at: string;
};

function groupByEmoji(reactions: Reaction[]): ReactionGroup[] {
  const groups = new Map<string, ReactionGroup>();

  for (const reaction of reactions) {
    const group = groups.get(reaction.emoji);

    if (!group) {
      groups.set(reaction.emoji, {
        emoji: reaction.emoji,
        count: 1,
        agentId: reaction.side === "org" ? reaction.agentId : null,
        mine: reaction.side === "org",
        at: reaction.at,
      });
      continue;
    }

    group.count += 1;

    if (reaction.side === "org") {
      group.agentId = reaction.agentId;
      group.mine = true;
    }
  }

  return [...groups.values()];
}

/** A chip the organization is part of: labelled with the agent, click to undo. */
function OrgChip({
  group,
  onRemove,
}: {
  group: ReactionGroup;
  onRemove?: () => void;
}) {
  const { translate: t } = useTranslation();
  const { data: agent } = useAgent(group.agentId!);

  return (
    <Tooltip title={agent?.name || t("Your organization")}>
      <button
        type="button"
        className={chipClasses + (onRemove ? " cursor-pointer" : "")}
        onClick={onRemove}
      >
        {group.emoji}
        {group.count > 1 && <span>{group.count}</span>}
      </button>
    </Tooltip>
  );
}

/**
 * The reaction pills hanging off a bubble's bottom edge.
 *
 * At most one reaction per party — the channel keeps a single one per
 * participant, and the organization is one participant however many agents sit
 * behind it (see `indexReactions`) — then identical emoji collapse into one
 * chip with a count, the way WhatsApp draws them.
 */
export default function MessageReactions({
  reactions,
  align,
  onRemove,
}: {
  reactions: Reaction[];
  align: "start" | "end";
  /** Removes the organization's reaction; omitted when sending is not allowed. */
  onRemove?: (emoji: string) => void;
}) {
  if (!reactions.length) return null;

  const groups = groupByEmoji(reactions);

  return (
    <div
      className={
        // Overhangs the bubble the way WhatsApp stacks it, but stays in flow so
        // the virtualizer measures the extra height.
        "flex gap-[3px] -mt-[9px] px-[8px] relative z-[1] " +
        (align === "end" ? "justify-end" : "justify-start")
      }
    >
      {groups.map((group) =>
        group.mine && group.agentId ? (
          <OrgChip
            key={group.emoji}
            group={group}
            onRemove={onRemove && (() => onRemove(group.emoji))}
          />
        ) : (
          <button
            key={group.emoji}
            type="button"
            disabled={!group.mine || !onRemove}
            className={
              chipClasses + (group.mine && onRemove ? " cursor-pointer" : "")
            }
            onClick={
              group.mine && onRemove ? () => onRemove(group.emoji) : undefined
            }
          >
            {group.emoji}
            {group.count > 1 && <span>{group.count}</span>}
          </button>
        ),
      )}
    </div>
  );
}
