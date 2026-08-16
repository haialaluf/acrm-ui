import { Fragment } from "react";
import { Tooltip } from "antd";
import { useAgent, useCurrentAgent } from "@/queries/useAgents";
import { useContactByAddress } from "@/queries/useContacts";
import { useTranslation } from "@/hooks/useTranslation";
import type { Reaction } from "@/utils/reactions";

const chipClasses =
  "flex items-center gap-[3px] rounded-full bg-background border border-border shadow-sm px-[6px] py-[1px] text-[12px] leading-[16px] select-none";

/** One emoji and everyone who used it — WhatsApp shows "❤️ 2", not "❤️ ❤️". */
type ReactionGroup = {
  emoji: string;
  reactors: Reaction[];
  /** Whether the organization is one of them: only then is the chip removable. */
  mine: boolean;
};

function groupByEmoji(reactions: Reaction[]): ReactionGroup[] {
  const groups = new Map<string, ReactionGroup>();

  for (const reaction of reactions) {
    const group = groups.get(reaction.emoji);

    if (!group) {
      groups.set(reaction.emoji, {
        emoji: reaction.emoji,
        reactors: [reaction],
        mine: reaction.side === "org",
      });
      continue;
    }

    group.reactors.push(reaction);
    group.mine ||= reaction.side === "org";
  }

  // The organization reads first, the way WhatsApp puts "You" at the top of a
  // reaction list.
  for (const group of groups.values()) {
    group.reactors.sort(
      (a, b) => (a.side === "org" ? 0 : 1) - (b.side === "org" ? 0 : 1),
    );
  }

  return [...groups.values()];
}

/* Each name resolves in its own component so every one of them makes exactly
   one hook call. Resolving a variable-length list inline would mean a varying
   number of hooks in a single component. */

function AgentName({ agentId }: { agentId: string }) {
  const { data: agent } = useAgent(agentId);

  return <>{agent?.name || "?"}</>;
}

function ContactName({ address }: { address: string }) {
  const { data: contact } = useContactByAddress(address);

  return <>{contact?.name || address}</>;
}

/** Who reacted with this emoji, in the order the chip lists them. */
function Reactors({ group }: { group: ReactionGroup }) {
  const { translate: t } = useTranslation();
  const { data: currentAgent } = useCurrentAgent();

  return (
    <>
      {group.reactors.map((reactor, index) => (
        <Fragment key={reactor.side + (reactor.agentId ?? reactor.at)}>
          {index > 0 && ", "}
          {reactor.side === "contact" ? (
            reactor.contactAddress ? (
              <ContactName address={reactor.contactAddress} />
            ) : (
              t("Contact")
            )
          ) : !reactor.agentId ? (
            t("Your organization")
          ) : reactor.agentId === currentAgent?.id ? (
            // Your own reaction reads as "You" rather than your own name, which
            // is what tells the two chips apart at a glance.
            t("You")
          ) : (
            <AgentName agentId={reactor.agentId} />
          )}
        </Fragment>
      ))}
    </>
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
      {groups.map((group) => {
        const removable = group.mine && !!onRemove;

        return (
          <Tooltip key={group.emoji} title={<Reactors group={group} />}>
            <button
              type="button"
              className={chipClasses + (removable ? " cursor-pointer" : "")}
              onClick={removable ? () => onRemove(group.emoji) : undefined}
            >
              {group.emoji}
              {group.reactors.length > 1 && (
                <span>{group.reactors.length}</span>
              )}
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}
