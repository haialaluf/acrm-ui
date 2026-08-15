import { useContext } from "react";
import dayjs from "dayjs";
import "dayjs/locale/es";
import "dayjs/locale/pt";
import { TickContext } from "@/contexts/useTick";
import useBoundStore from "@/stores/useBoundStore";
import { useTranslation } from "@/hooks/useTranslation";
import { useActiveConversation } from "@/hooks/useThread";
import type { MessageRow } from "@/supabase/client";

/**
 * The 24-hour customer service window of the active thread.
 *
 * WhatsApp and Instagram only accept free-form messages within a day of the
 * contact's last one — and a reaction is a message like any other, so both the
 * composer and the reaction picker gate on this.
 */
export function useCSWindow() {
  const conv = useActiveConversation();
  const tick = useContext(TickContext); // one-minute ticks
  const { currentLanguage } = useTranslation();

  const mostRecentIncoming: MessageRow | undefined = useBoundStore((store) => {
    const msgs = store.chat.messages
      .get(store.ui.activeThreadKey || "")
      ?.values();

    if (!msgs) {
      return;
    }

    for (const msg of msgs) {
      if (msg.direction === "incoming") {
        return msg;
      }
    }
  });

  const deadline = dayjs(mostRecentIncoming?.timestamp || 0).add(1, "day");

  return {
    /** Whether the user is allowed to send to the contact right now. */
    inCSWindow:
      (conv?.service !== "whatsapp" && conv?.service !== "instagram") ||
      tick.isBefore(deadline),
    /** Humanized time left in the window, e.g. "3 hours". */
    remaining: tick.locale(currentLanguage).to(deadline, true),
  };
}
