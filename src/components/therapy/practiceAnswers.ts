import dayjs from "dayjs";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/supabase/client";
import useBoundStore from "@/stores/useBoundStore";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useContacts } from "@/queries/useContacts";
import { queryKeys } from "@/queries/queryKeys";
import { throwFunctionError } from "@/queries/throwFunctionError";
import type { AppointmentRow } from "@/queries/useAppointments";
import type { Answer } from "./AiChat";
import type { ChatMessage, ChatThread } from "./therapyStore";
import type { AskAiSpeed } from "./ClinicAiPrivacy";

function useOrgAppointments() {
  const orgId = useBoundStore((state) => state.ui.activeOrgId);
  return useQuery({
    queryKey: [...queryKeys.appointments.org(orgId), "practice-ai"],
    queryFn: async () => {
      const { data } = await supabase
        .from("appointments")
        .select()
        .eq("organization_id", orgId!)
        .not("contact_id", "is", null)
        .throwOnError();
      return (data ?? []) as AppointmentRow[];
    },
    enabled: !!orgId,
  });
}

/** What the model sees of an earlier answer when the therapist follows up. */
function asText(message: ChatMessage) {
  return [
    message.text,
    ...(message.bullets ?? []).map((b) => `- ${b.text}`),
    ...(message.table
      ? [
          message.table.head.join(" | "),
          ...message.table.rows.map((r) => r.cells.join(" | ")),
        ]
      : []),
  ]
    .filter(Boolean)
    .join("\n");
}

export function usePracticeAnswers() {
  const orgId = useBoundStore((state) => state.ui.activeOrgId);
  const { money } = useWorkspace();
  const { data: contacts } = useContacts();
  const { data: appointments } = useOrgAppointments();

  async function answer(
    thread: ChatThread,
    speed: AskAiSpeed,
  ): Promise<Answer> {
    const { data, error } = await supabase.functions.invoke<Answer>(
      "practice-ask",
      {
        body: {
          organization_id: orgId,
          speed,
          messages: thread.messages
            .filter((m) => !m.failed)
            .map((m) => ({
              role: m.role,
              text: asText(m),
            })),
        },
      },
    );
    if (error) await throwFunctionError(error);
    return data!;
  }

  function draftReminders(message: ChatMessage): Answer | null {
    const people = new Map((contacts ?? []).map((c) => [c.id, c]));
    const now = dayjs();
    const drafts = (message.table?.rows ?? []).flatMap((row) => {
      const contact = row.contactId && people.get(row.contactId);
      if (!contact) return [];
      const unpaid = (appointments ?? [])
        .filter(
          (a) =>
            a.contact_id === contact.id &&
            a.status !== "cancelled" &&
            dayjs(a.starts_at).isBefore(now) &&
            !a.extra?.paid,
        )
        .map((a) => a.starts_at)
        .sort();
      if (unpaid.length === 0) return [];
      const price = contact.extra?.session_price;
      const name = contact.name || "Unnamed";
      return [
        {
          contactId: contact.id,
          name,
          text: `Hi ${name.split(" ")[0]}, a friendly reminder that there ${unpaid.length === 1 ? "is 1 session" : `are ${unpaid.length} sessions`} from ${dayjs(unpaid[0]).format("D MMM")} still open${price ? ` (${money(unpaid.length * price)})` : ""}. You can pay at our next meeting or by bank transfer. Thanks!`,
        },
      ];
    });
    if (drafts.length === 0) return null;
    return {
      text: `${drafts.length === 1 ? "Here's a WhatsApp draft" : `Here are ${drafts.length} WhatsApp drafts`}. Nothing has been sent; open the patient to review and send.`,
      drafts,
    };
  }

  return { answer, draftReminders };
}
