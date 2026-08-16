import { X } from "lucide-react";
import { type MessageRow } from "@/supabase/client";
import { useAgent, useCurrentAgent } from "@/queries/useAgents";
import { useContactByAddress } from "@/queries/useContacts";
import { useCurrentOrganization } from "@/queries/useOrganizations";
import { useTranslation } from "@/hooks/useTranslation";
import { mediaPreview, messagePreviewText } from "@/utils/messagePreview";

/* Each name resolves in its own component so every one of them makes exactly
   one hook call — the same reason MessageReactions splits them out. */

function AgentName({ agentId }: { agentId: string }) {
  const { data: agent } = useAgent(agentId);
  const { data: currentAgent } = useCurrentAgent();
  const { translate: t } = useTranslation();

  // Your own message reads as "You", the way WhatsApp labels it.
  if (agentId === currentAgent?.id) return <>{t("You")}</>;

  return <>{agent?.name || "?"}</>;
}

function ContactName({ address }: { address: string }) {
  const { data: contact } = useContactByAddress(address);

  return <>{contact?.name || address}</>;
}

function OrganizationName() {
  const { data: org } = useCurrentOrganization();

  return <>{org?.name || "?"}</>;
}

/** Who sent the quoted message. */
function Sender({ message }: { message: MessageRow }) {
  if (message.direction === "incoming") {
    return message.contact_address ? (
      <ContactName address={message.contact_address} />
    ) : (
      <OrganizationName />
    );
  }

  // Anything the organization sent: the agent behind it when there is one, the
  // organization itself when it came from the bot or an automation.
  return message.agent_id ? (
    <AgentName agentId={message.agent_id} />
  ) : (
    <OrganizationName />
  );
}

/**
 * The quoted block of a reply — WhatsApp's grey card with an accent bar, the
 * original sender's name and a one-line preview.
 *
 * Drawn in three places off the same component so they cannot drift: inside the
 * bubble of a reply, above the composer while a reply is pending, and above the
 * file previewer's caption input.
 *
 * `message` is undefined when the original is not in the loaded window — the
 * card still appears (the reply *is* a reply), it just cannot name what it
 * points at or scroll to it.
 */
export default function QuotedMessage({
  message,
  onClick,
  onClose,
  className,
}: {
  message?: MessageRow;
  /** Jumps to the original. Omitted when it is not loaded. */
  onClick?: () => void;
  /** Clears a pending reply; only the composer passes this. */
  onClose?: () => void;
  className?: string;
}) {
  const { translate: t } = useTranslation();

  const { mediaIcon, mediaPreviewContent } = mediaPreview(t, message);

  // The organization's own side is the app's green; the contact gets WhatsApp's
  // teal, which is what makes the two readable at a glance.
  const mine = message ? message.direction !== "incoming" : true;
  const accentBar = mine ? "bg-primary" : "bg-teal-500";
  const accentText = mine ? "text-primary" : "text-teal-600 dark:text-teal-400";

  return (
    <div
      className={
        "flex items-stretch rounded-[6px] overflow-hidden bg-foreground/[0.06] min-w-[160px] max-w-full text-start" +
        (onClick ? " cursor-pointer" : "") +
        (className ? " " + className : "")
      }
      onClick={onClick}
    >
      <div className={"w-[4px] shrink-0 " + accentBar} />

      <div className="min-w-0 grow py-[4px] px-[8px]">
        <div className={"text-[13px] leading-[18px] font-medium " + accentText}>
          {message ? <Sender message={message} /> : t("Original message")}
        </div>

        <div className="flex items-center text-[13px] leading-[18px] text-muted-foreground">
          {mediaIcon}
          <div className="truncate">
            {message ? messagePreviewText(message, mediaPreviewContent) : ""}
          </div>
        </div>
      </div>

      {onClose && (
        <button
          type="button"
          title={t("Cancel reply")}
          className="shrink-0 px-[8px] cursor-pointer text-muted-foreground hover:text-foreground"
          onClick={(event) => {
            event.stopPropagation();
            onClose();
          }}
        >
          <X className="w-[18px] h-[18px]" />
        </button>
      )}
    </div>
  );
}
