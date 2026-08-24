import { useContext } from "react";
import Avatar from "./Avatar";
import { getStatusPresentation } from "@/utils/MessageStatusUtils";
import useBoundStore from "@/stores/useBoundStore";
import {
  type Draft,
  type InstagramContactAddressExtra,
  type MessageRow,
  type OutgoingStatus,
} from "@/supabase/client";
import { InstagramOutlined, WhatsAppOutlined } from "@ant-design/icons";
import ItemActions from "./ItemActions";
import dayjs from "dayjs";
import "dayjs/locale/es";
import "dayjs/locale/pt";
import localizedFormat from "dayjs/plugin/localizedFormat";
dayjs.extend(localizedFormat);
import { TickContext } from "@/contexts/useTick";
import { useTranslation } from "@/hooks/useTranslation";
import { AtSign, Bot, Handshake, Mail, Pause } from "lucide-react";

import { useCurrentAgent, useCurrentAgents } from "@/queries/useAgents";
import { useContactByAddress } from "@/queries/useContacts";
import { useContactAddress } from "@/queries/useContactsAddresses";
import { formatPhoneNumber, nameInitials } from "@/utils/FormatUtils";
import { useNavigate } from "@tanstack/react-router";
import { useThreadConversation } from "@/hooks/useThread";
import { contactAddressName } from "@/utils/ContactAddressUtils";
import { assistantState } from "@/utils/ConversationUtils";
import { useCurrentOrganization } from "@/queries/useOrganizations";
import { mediaPreview } from "@/utils/messagePreview";

function statusIcon(status: OutgoingStatus, t: (text: string) => string) {
  const { icon, color, title } = getStatusPresentation(status);

  return (
    <div>
      <svg
        className={
          `h-[18px] mr-[2px] ${color}` +
          (icon === "clock" ? " w-[14px]" : " w-[18px]")
        }
      >
        {title && <title>{t(title)}</title>}
        <use href={`/icons.svg#chat-${icon}`} />
      </svg>
    </div>
  );
}

function severityClass(hours: number) {
  if (hours < 6) {
    return { text: "text-green-500", bg: "bg-green-500" }; // First six hours (green)
  } else if (hours < 12) {
    return { text: "text-yellow-500", bg: "bg-yellow-500" }; // Second six hours (yellow)
  } else if (hours < 24) {
    return { text: "text-red-500", bg: "bg-red-500" }; // Remaining twelve hours (red)
  } else {
    return { text: "text-muted-foreground", bg: "bg-muted-foreground" }; // Overdue (gray)
  }
}

export default function ChatListItem({ itemId }: { itemId: string }) {
  const navigate = useNavigate();
  const activeThreadKey = useBoundStore((state) => state.ui.activeThreadKey);

  const active = itemId === activeThreadKey;

  const conversation = useThreadConversation(itemId);

  const { data: contact } = useContactByAddress(conversation?.contact_address);
  const { data: contactAddress } = useContactAddress(
    conversation?.contact_address,
  );

  const { data: agent } = useCurrentAgent();
  const { data: agents } = useCurrentAgents();
  const { data: org } = useCurrentOrganization();
  const isAdmin = ["admin", "owner"].includes(agent?.extra?.role || "");

  // The sidebar only ever holds the thread's most recent message (or whatever
  // the open conversation loaded), so this list is a preview source, never a
  // basis for counting.
  const messages: MessageRow[] | undefined = Array.from(
    useBoundStore((state) => state.chat.messages.get(itemId || ""))?.values() ||
      [],
  );

  // Counted server-side by `conversations_page` over the whole history and kept
  // live by realtime — the loaded window is far too small to derive it here.
  const unreadCount = useBoundStore(
    (state) => state.chat.threads.get(itemId)?.unread ?? 0,
  );

  // If the role is not admin, then do not show internal messages.
  const mostRecent = messages?.find(
    (m) => isAdmin || m.direction !== "internal",
  );

  const draft: Draft | null | undefined = conversation?.extra?.draft;

  const preview =
    +new Date(mostRecent?.timestamp || 0) >= +new Date(draft?.timestamp || 0)
      ? mostRecent
      : ({
          direction: "incoming", // direction is not important, except that incoming does not display status icons, which is correct for drafts
          content: {
            version: "1",
            type: "text",
            kind: "text",
            text: draft!.text,
          },
          timestamp: draft!.timestamp,
          status: {},
        } as MessageRow);

  const unread = (() => {
    let notification = false;

    // The @-mention marker still comes from the loaded messages: it only
    // matters for a thread that has unanswered incoming messages, and those
    // are exactly the ones whose tail is loaded.
    for (const msg of messages ?? []) {
      if (
        msg.direction === "internal" &&
        // @ts-expect-error notification is deprecated (TODO: remove)
        msg.content.kind === "notification"
      ) {
        notification = true;
      } else if (
        msg.direction === "outgoing" &&
        agents
          ?.filter((a) => !a.ai)
          .map((a) => a.id)
          .includes(msg.agent_id || "")
      ) {
        // Only humans can mark notifications as responded.
        break;
      }
    }

    return { count: unreadCount, notification };
  })();

  const tick = useContext(TickContext); // one-minute ticks

  const isPinned = conversation?.extra?.pinned;

  // Paused by a person, or off org-wide (default agent "None"). A handoff no
  // longer pauses the assistant — see `handoff` below for that badge instead.
  const isPaused = assistantState(conversation, org?.extra) !== "active";

  // Set when the agent handed this conversation off to a person and cleared
  // the moment one of them actually replies here — so its presence means
  // still waiting.
  const handoff = conversation?.extra?.handoff;

  const igExtra =
    conversation?.service === "instagram"
      ? (contactAddress?.extra as InstagramContactAddressExtra | null)
      : null;

  // Name fallback order: conversation.name → contact.name →
  // contactAddressName(contactAddress) → @username (Instagram)
  const name =
    conversation?.name ||
    contact?.name ||
    contactAddressName(contactAddress) ||
    (igExtra?.username ? `@${igExtra.username}` : undefined);

  // When there is no name, show the (formatted) contact address instead of "?".
  // WhatsApp addresses are phone numbers; Instagram addresses need no formatting.
  const address = conversation?.contact_address;
  const displayName =
    name ||
    (address
      ? conversation?.service === "whatsapp"
        ? formatPhoneNumber(address)
        : address
      : "?");

  const { translate: t, currentLanguage } = useTranslation();

  function formatTime(timestamp: string): string {
    const dayjsTs = dayjs(timestamp).locale(currentLanguage);

    const days = dayjs().diff(dayjsTs, "day", true);

    if (days < 1) return dayjsTs.format("HH:mm");

    if (days < 2) return t("yesterday");

    if (days < 7) return dayjsTs.format("dddd"); // Jueves

    return dayjsTs.format("l"); // 7/5/2024
  }

  const { mediaIcon, mediaPreviewContent } = mediaPreview(t, preview);

  // Note: severity depends on the most recent incoming message timestamp.
  // `mostRecent` does not distinguish between incoming/outgoing. Nonetheless
  // `severity` is used when `unread` is greater than zero. This only happens
  // when the most recent messages are of the incoming type.
  const severity = severityClass(
    tick.diff(mostRecent?.timestamp, "hours", true),
  );

  return (
    conversation && (
      <ItemActions trigger={["contextMenu"]} itemId={itemId} name={displayName}>
        <div
          className={
            "chat-list-item h-[72px] flex cursor-pointer rounded-xl group" +
            (active ? " bg-accent" : " hover:bg-accent")
          }
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            // setActiveConv(itemId);
            navigate({ to: "/conversations", hash: itemId });
          }}
        >
          <div className="profile-picture pl-[10px] pr-[15px] flex items-center">
            <div className="relative">
              <Avatar
                src={igExtra?.profile_picture_url}
                fallback={nameInitials(name || "?")}
                size={49}
                className="bg-accent text-accent-foreground border border-border text-[16px]"
              />
              <div className="absolute -bottom-[1px] -right-[1px] rounded-full bg-background p-[1px] leading-none">
                {conversation.service === "instagram" ? (
                  <InstagramOutlined
                    style={{ fontSize: "14px", color: "#E1306C" }}
                  />
                ) : conversation.service === "email" ? (
                  <Mail className="h-[14px] w-[14px] text-blue-500" />
                ) : conversation.service === "local" ? (
                  // A test chat talks to the org's own bot, so the channel slot
                  // gets a robot where the other services get their logo.
                  <Bot className="h-[14px] w-[14px] text-muted-foreground" />
                ) : (
                  <WhatsAppOutlined
                    style={{ fontSize: "14px", color: "#25D366" }}
                  />
                )}
              </div>
            </div>
          </div>
          <div className="info flex flex-col justify-center grow min-w-0 pr-[15px]">
            {/* Upper row */}
            <div className="flex justify-between items-baseline">
              <div dir="auto" className="truncate text-foreground text-[16px]">
                {displayName}
              </div>
              <div
                className={
                  "text-[12px] ml-[6px] capitalize" +
                  (unread.count
                    ? ` ${severity.text} font-bold`
                    : " text-muted-foreground")
                }
              >
                {preview && formatTime(preview.timestamp)}
              </div>
            </div>
            {/* Lower row */}
            <div className="flex justify-between mt-[2px] items-start">
              <div className="min-w-0 flex items-start text-muted-foreground">
                {preview?.direction === "outgoing" &&
                  statusIcon(preview.status, t)}
                {preview?.agent_id && preview.agent_id !== agent?.id && (
                  <div className="text-primary text-[14px] mr-1 shrink-0">
                    {agents?.find((a) => a.id === preview.agent_id)?.name ||
                      "?"}
                    :
                  </div>
                )}
                {mediaIcon}
                {draft && (
                  <div className="text-[14px] text-primary mr-1">
                    {t("Draft:")}
                  </div>
                )}
                {preview?.content.type === "data" &&
                  preview?.content.kind === "template" && (
                    <div className="text-[14px] text-primary mr-1">
                      {t("Template:")}
                    </div>
                  )}
                <div className="truncate text-[14px]">
                  {preview?.content.type === "text" && preview.content.text}
                  {/* A data part that was rendered for display (a template, for
                      one) carries the flattened text the recipient sees — show
                      that rather than the raw payload. The JSON stays as the
                      fallback for parts with nothing human-readable. */}
                  {preview?.content.type === "data" &&
                    preview.content.kind !== "media_placeholder" &&
                    (preview.content.text ||
                      JSON.stringify(preview.content.data))}
                  {(preview?.content.type === "file" ||
                    (preview?.content.type === "data" &&
                      preview.content.kind === "media_placeholder")) &&
                    mediaPreviewContent}
                </div>
              </div>

              <div className="flex flex-row items-center">
                {/* Pause - AI assistant paused */}
                {isPaused && (
                  <Pause className="h-[19px] w-[19px] ml-[6px] fill-muted-foreground stroke-0" />
                )}
                {/* Handoff - waiting on a person, doesn't pause the assistant */}
                {handoff && (
                  <span
                    className="ml-[6px]"
                    title={`${t("Waiting on a person")}: ${handoff.reason}`}
                  >
                    <Handshake className="h-[17px] w-[17px] text-muted-foreground" />
                  </span>
                )}
                {/* Pin - For now just conversations can be fixed */}
                {isPinned && (
                  <svg className="h-[18px] w-[12px] ml-[6px] text-muted-foreground">
                    <use href="/icons.svg#pin" />
                  </svg>
                )}
                {/* Mention */}
                {unread.notification && (
                  <AtSign
                    className={`h-[15px] w-[15px] ml-[6px] ${severity.text}`}
                  />
                )}
                {/* Pending messages badge */}
                {unread.count > 0 && (
                  <div className="ml-[6px]">
                    <span
                      className={`font-bold text-[12px] text-white rounded-full py-[2px] px-[6px] ${severity.bg}`}
                    >
                      {unread.count}
                    </span>
                  </div>
                )}
                <ItemActions
                  trigger={["click"]}
                  itemId={itemId}
                  name={displayName}
                >
                  <svg
                    className="h-[20px] w-[19px] ml-[6px] text-muted-foreground hidden group-hover:block pointer-coarse:block"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <use href="/icons.svg#down" />
                  </svg>
                </ItemActions>
              </div>
            </div>
          </div>
        </div>
      </ItemActions>
    )
  );
}
