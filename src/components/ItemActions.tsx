import { useState } from "react";
import { Dropdown, type MenuProps } from "antd";
import { Trash2 } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import useBoundStore from "@/stores/useBoundStore";
import { type MessageRow } from "@/supabase/client";
import { isArchived } from "@/stores/uiSlice";
import { useTranslation } from "@/hooks/useTranslation";
import { updateConvExtra } from "@/utils/ConversationUtils";
import { useThreadConversation } from "@/hooks/useThread";
import { useCurrentAgent } from "@/queries/useAgents";
import { useDeleteConversation } from "@/queries/useConversations";
import ConfirmModal from "./ConfirmModal";

export default function ItemActions({
  children,
  itemId,
  name,
  trigger,
  visible,
}: {
  children: React.ReactNode;
  itemId: string;
  /** Shown in the delete confirmation, so it names the chat being wiped. */
  name?: string;
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
  const navigate = useNavigate();

  const activeThreadKey = useBoundStore((state) => state.ui.activeThreadKey);
  const { data: agent } = useCurrentAgent();
  const isAdmin = ["admin", "owner"].includes(agent?.extra?.role || "");

  const deleteConversation = useDeleteConversation();
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!conversation) {
    return children;
  }

  const isPinned = conversation.extra?.pinned;

  function onDelete() {
    deleteConversation.mutate(conversation!, {
      onSuccess: () => {
        setConfirmDelete(false);

        // The center panel is showing a chat that no longer exists.
        if (itemId === activeThreadKey) {
          void navigate({ hash: undefined });
        }
      },
    });
  }

  const items: MenuProps["items"] = [
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
      key: "3",
      disabled: true,
    },*/
    // Deleting wipes the thread's whole history for the entire organization,
    // so only admins and owners are offered it — the restrictive RLS policy on
    // `conversations` enforces the same rule server-side.
    ...(isAdmin
      ? [
          {
            label: t("Delete chat"),
            key: "4",
            icon: <Trash2 className="w-[15px] h-[15px]" />,
            danger: true,
            onClick: () => {
              // Clear a previous failure so a reopened dialog starts clean.
              deleteConversation.reset();
              setConfirmDelete(true);
            },
          },
        ]
      : []),
  ];

  return (
    <>
      <Dropdown
        menu={{ items }}
        trigger={trigger}
        className={`${visible || visible == undefined ? "visible" : "hidden"} rounded-none`}
      >
        {children}
      </Dropdown>

      <ConfirmModal
        open={confirmDelete}
        onCancel={() => setConfirmDelete(false)}
        title={t("Delete chat")}
        confirmLabel={t("Delete")}
        loading={deleteConversation.isPending}
        onConfirm={onDelete}
        body={
          <>
            <p className="text-[15px] text-foreground">
              {t("Delete this chat?")}
            </p>
            {name && (
              <p className="text-[14px] font-medium text-foreground mt-1">
                {name}
              </p>
            )}
            <p className="text-[13px] text-muted-foreground mt-2">
              {t(
                "The whole message history will be permanently deleted for everyone in the organization.",
              )}{" "}
              {t("This action cannot be undone.")}
            </p>
            {deleteConversation.isError && (
              <p className="text-[13px] text-destructive mt-2">
                {t("Could not delete the chat. Please try again.")}
              </p>
            )}
          </>
        }
      />
    </>
  );
}
