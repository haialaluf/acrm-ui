import { Dropdown, type MenuProps } from "antd";
import useBoundStore from "@/stores/useBoundStore";
import { type MessageRow } from "@/supabase/client";
import { isArchived } from "@/stores/uiSlice";
import { useTranslation } from "@/hooks/useTranslation";
import { updateConvExtra } from "@/utils/ConversationUtils";
import { useThreadConversation } from "@/hooks/useThread";

export default function ItemActions({
  children,
  itemId,
  trigger,
  visible,
}: {
  children: React.ReactNode;
  itemId: string;
  trigger: ("contextMenu" | "click" | "hover")[] | undefined;
  visible?: boolean;
}) {
  const conversation = useThreadConversation(itemId);
  const mostRecentMsg: MessageRow | undefined = useBoundStore(
    (state) =>
      state.chat.messages
        .get(itemId || "")
        ?.values()
        .next().value,
  );

  const { translate: t } = useTranslation();

  if (!conversation) {
    return children;
  }

  const isPinned = conversation.extra?.pinned;

  const isPaused =
    +new Date(conversation.extra?.paused || 0) >
    +new Date() - 12 * 60 * 60 * 1000; // Less than 12 hours ago.

  const items: MenuProps["items"] = [
    {
      label: isPaused ? t("Resume assistant") : t("Pause assistant"),
      key: "0",
      onClick: () =>
        updateConvExtra(conversation, {
          paused: isPaused ? null : new Date().toISOString(),
        }),
    },
    {
      label: isArchived(conversation, mostRecentMsg)
        ? t("Unarchive chat")
        : t("Archive chat"),
      key: "1",
      onClick: () =>
        updateConvExtra(conversation, {
          archived: isArchived(conversation, mostRecentMsg)
            ? null
            : new Date().toISOString(),
        }),
    },
    {
      label: isPinned ? t("Unpin chat") : t("Pin chat"),
      key: "2",
      onClick: () =>
        updateConvExtra(conversation, {
          pinned: isPinned ? null : new Date().toISOString(),
        }),
    },
    /*{
      label: t("Mark as unread"),
      key: "2",
      disabled: true,
    },*/
  ];

  return (
    <Dropdown
      menu={{ items }}
      trigger={trigger}
      className={`${visible || visible == undefined ? "visible" : "hidden"} rounded-none`}
    >
      {children}
    </Dropdown>
  );
}
