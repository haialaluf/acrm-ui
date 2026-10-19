import { supabase, type ContactWithAddressesRow } from "@/supabase/client";
import { throwFunctionError } from "@/queries/throwFunctionError";
import type { Answer } from "./AiChat";
import type { ChatThread } from "./therapyStore";
import type { AskAiSpeed } from "./ClinicAiPrivacy";
import { asText } from "./practiceAnswers";

function firstName(contact: ContactWithAddressesRow) {
  return contact.firstname || contact.name?.split(" ")[0] || "the patient";
}

export function usePatientAnswers(contact: ContactWithAddressesRow) {
  async function answer(
    thread: ChatThread,
    speed: AskAiSpeed,
  ): Promise<Answer> {
    const { data, error } = await supabase.functions.invoke<Answer>(
      "practice-ask/patient",
      {
        body: {
          contact_id: contact.id,
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
