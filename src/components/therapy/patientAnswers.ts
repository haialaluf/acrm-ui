import { supabase, type ContactWithAddressesRow } from "@/supabase/client";
import { throwFunctionError } from "@/queries/throwFunctionError";
import type { Answer } from "./AiChat";
import type { ChatThread } from "./therapyStore";
import type { AskAiSpeed } from "./ClinicAiPrivacy";
import { asText } from "./practiceAnswers";

function firstName(contact: ContactWithAddressesRow) {
  return contact.firstname || contact.name?.split(" ")[0] || "the patient";
}

/** With `reportId`, the answer also draws on that report and its transcript
 *  (the panel is open beside it). */
export function usePatientAnswers(
  contact: ContactWithAddressesRow,
  reportId?: string,
) {
  async function answer(
    thread: ChatThread,
    speed: AskAiSpeed,
  ): Promise<Answer> {
    const { data, error } = await supabase.functions.invoke<Answer>(
      "practice-ask/patient",
      {
        body: {
          contact_id: contact.id,
          report_id: reportId,
          speed,
          messages: thread.messages
            .filter((m) => !m.failed)
            .map((m) => ({ role: m.role, text: asText(m) })),
        },
      },
    );
    if (error) await throwFunctionError(error);
    return data!;
  }

  return { answer, name: firstName(contact) };
}
