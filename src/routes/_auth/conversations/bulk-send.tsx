import { useEffect, useMemo, useRef, useState } from "react";
import {
  createFileRoute,
  useNavigate,
  useSearch,
} from "@tanstack/react-router";

import { useTranslation } from "@/hooks/useTranslation";
import { useContacts } from "@/queries/useContacts";
import { useCurrentAgent } from "@/queries/useAgents";
import { useTemplates } from "@/queries/useTemplates";
import { useOrganizationsAddresses } from "@/queries/useOrganizationsAddresses";
import { pushMessageToStore } from "@/utils/MessageUtils";
import { startConversation } from "@/utils/ConversationUtils";
import useBoundStore from "@/stores/useBoundStore";
import {
  type ContactWithAddressesRow,
  type ConversationInsert,
  type ConversationRow,
  type MessageInsert,
  supabase,
  type TemplateData,
} from "@/supabase/client";
import { formatPhoneNumber } from "@/utils/FormatUtils";

import WizardHeader from "@/components/bulkSend/WizardHeader";
import RecipientsStep from "@/components/bulkSend/RecipientsStep";
import TemplateStep from "@/components/bulkSend/TemplateStep";
import VariablesStep from "@/components/bulkSend/VariablesStep";
import ReviewStep from "@/components/bulkSend/ReviewStep";
import SendingStep from "@/components/bulkSend/SendingStep";
import DoneStep from "@/components/bulkSend/DoneStep";
import { buildMessageRecord } from "@/components/bulkSend/buildMessageRecord";
import {
  countVars,
  initVars,
  type Scheduling,
  type Stage,
  STEP_FOR,
  type VarValue,
} from "@/components/bulkSend/types";

type BulkSendSearch = {
  /** Pre-fill a single recipient (used when this wizard is opened from inside
   *  a conversation by picking a template). */
  contactId?: string;
  /** Pre-fill the chosen template; combined with `contactId` it jumps the
   *  wizard straight to the Variables step. */
  templateId?: string;
};

export const Route = createFileRoute("/_auth/conversations/bulk-send")({
  component: BulkSend,
  validateSearch: (raw: Record<string, unknown>): BulkSendSearch => ({
    contactId: typeof raw.contactId === "string" ? raw.contactId : undefined,
    templateId: typeof raw.templateId === "string" ? raw.templateId : undefined,
  }),
});

/**
 * Multi-step wizard for sending a WhatsApp template to many contacts at once.
 * Stages: recipients → template → variables → review → sending → done.
 * Each stage component lives in `src/components/bulkSend/`. This file owns the
 * shared state and the batched send (two bulk supabase requests, regardless of
 * recipient count).
 */
function BulkSend() {
  const { translate: t } = useTranslation();
  const navigate = useNavigate();
  const { contactId: prefillContactId, templateId: prefillTemplateId } =
    useSearch({ from: "/_auth/conversations/bulk-send" });
  const activeOrgId = useBoundStore((s) => s.ui.activeOrgId);
  const { data: agent } = useCurrentAgent();
  const agentId = agent?.id;
  const { data: contacts } = useContacts();
  const { data: addresses } = useOrganizationsAddresses();
  const whatsappAddress = addresses?.find((a) => a.service === "whatsapp");
  const { data: templates } = useTemplates(whatsappAddress?.address);
  const approved = useMemo(
    () => (templates ?? []).filter((tpl) => tpl.status === "APPROVED"),
    [templates],
  );

  // wizard state
  const [stage, setStage] = useState<Stage>("recipients");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [template, setTemplate] = useState<TemplateData | null>(null);
  const [vars, setVars] = useState<Record<string, VarValue>>({});
  const [scheduling, setScheduling] = useState<Scheduling>("now");
  const [scheduledAt, setScheduledAt] = useState("");
  const [progress, setProgress] = useState({ sent: 0, failed: 0 });

  // Prefill once data is loaded. Guarded so we don't re-apply if the user
  // navigates back inside the wizard.
  const appliedPrefillRef = useRef(false);
  useEffect(() => {
    if (
      appliedPrefillRef.current ||
      !prefillContactId ||
      !prefillTemplateId ||
      !contacts?.length ||
      !approved?.length
    ) {
      return;
    }
    const tpl = approved.find((t) => t.id === prefillTemplateId);
    const contact = contacts.find((c) => c.id === prefillContactId);
    if (!tpl || !contact) return;
    appliedPrefillRef.current = true;
    setSelectedIds(new Set([contact.id]));
    setTemplate(tpl);
    const headN = countVars(
      tpl.components.find((c) => c.type === "HEADER")?.text,
    );
    const bodyN = countVars(
      tpl.components.find((c) => c.type === "BODY")?.text,
    );
    setVars(initVars(headN, bodyN));
    setStage("variables");
  }, [prefillContactId, prefillTemplateId, contacts, approved]);

  /* Resolved recipients (contacts with at least one address). */
  const recipients = useMemo<ContactWithAddressesRow[]>(() => {
    return (contacts ?? []).filter(
      (c) => selectedIds.has(c.id) && c.addresses?.[0]?.address,
    );
  }, [contacts, selectedIds]);

  function back() {
    if (stage === "template") setStage("recipients");
    else if (stage === "variables") setStage("template");
    else if (stage === "review") setStage("variables");
    else navigate({ to: "/conversations", hash: (h) => h! });
  }

  async function send() {
    if (!template || !whatsappAddress || !activeOrgId) return;
    if (scheduling === "later" && !scheduledAt) return;
    const scheduledIso = scheduling === "later" && scheduledAt
      ? new Date(scheduledAt).toISOString()
      : undefined;
    setStage("sending");
    setProgress({ sent: 0, failed: 0 });

    // Build all records locally so we can ship them in two bulk inserts
    // (conversations + messages) instead of 2N round-trips. Existing
    // conversations are reused; new ones are optimistically added to the
    // store and queued for a single insert.
    const conversationsToInsert: ConversationInsert[] = [];
    const messageRecords: MessageInsert[] = [];
    const skipped: ContactWithAddressesRow[] = [];

    const storeConvs = useBoundStore.getState().chat.conversations;

    for (const contact of recipients) {
      const phone = contact.addresses?.[0]?.address;
      if (!phone) {
        skipped.push(contact);
        continue;
      }

      let conv: ConversationRow | undefined = Array.from(storeConvs.values())
        .find(
          (c) =>
            c.organization_address === whatsappAddress.address &&
            c.contact_address === phone,
        );

      if (!conv) {
        const id = startConversation({
          organization_id: activeOrgId,
          organization_address: whatsappAddress.address,
          contact_address: phone,
          service: "whatsapp",
          name: contact.name || formatPhoneNumber(phone),
        });
        conv = useBoundStore.getState().chat.conversations.get(id!);
        if (!conv) {
          skipped.push(contact);
          continue;
        }
        if (!conv.updated_at) {
          conversationsToInsert.push(conv);
        }
      }

      const record = buildMessageRecord({
        contact,
        conv,
        template,
        vars,
        agentId,
        scheduledAt: scheduledIso,
      });
      if (!record) {
        skipped.push(contact);
        continue;
      }
      // Skip optimistic push for scheduled messages — the chat filters
      // `timestamp <= updated_at`, so a future-timestamped message would
      // flicker into the conversation and disappear once the server row
      // syncs back.
      if (!scheduledIso) pushMessageToStore(record);
      messageRecords.push(record);
    }

    let failed = skipped.length;
    try {
      if (conversationsToInsert.length) {
        const { error } = await supabase
          .from("conversations")
          .insert(conversationsToInsert);
        if (error) throw error;
      }
      if (messageRecords.length) {
        const { error } = await supabase
          .from("messages")
          .upsert(messageRecords, { ignoreDuplicates: true });
        if (error) throw error;
      }
      setProgress({ sent: messageRecords.length, failed });
    } catch (e) {
      console.error("bulk-send failed", e);
      failed += messageRecords.length;
      setProgress({ sent: 0, failed });
    }

    setStage("done");
  }

  function reset() {
    setStage("recipients");
    setSelectedIds(new Set());
    setTemplate(null);
    setVars({});
    setScheduling("now");
    setScheduledAt("");
    setProgress({ sent: 0, failed: 0 });
  }

  // Header content varies by stage.
  const header = (() => {
    const step = STEP_FOR[stage];
    switch (stage) {
      case "recipients":
        return {
          title: t("Envío masivo"),
          subtitle: t("Elige los destinatarios"),
          step,
          showProgress: true,
        };
      case "template":
        return {
          title: t("Elige una plantilla"),
          subtitle: `${selectedIds.size} ${t("destinatarios")}`,
          step,
          showProgress: true,
        };
      case "variables":
        return {
          title: t("Variables"),
          subtitle: template?.name,
          step,
          showProgress: true,
        };
      case "review":
        return {
          title: t("Vista previa y envío"),
          subtitle: `${recipients.length} ${
            t("destinatarios")
          } · ${template?.name}`,
          step,
          showProgress: true,
        };
      case "sending":
        return {
          title: t("Enviando…"),
          subtitle: template?.name,
          step,
          showProgress: false,
        };
      case "done":
        return {
          title: t("Envío completado"),
          subtitle: template?.name,
          step,
          showProgress: false,
        };
    }
  })();

  return (
    <div className="flex flex-col h-full">
      <WizardHeader
        title={header.title}
        subtitle={header.subtitle}
        onBack={stage === "sending" || stage === "done" ? undefined : back}
        step={header.step}
        showProgress={header.showProgress}
      />

      {stage === "recipients" && (
        <RecipientsStep
          selectedIds={selectedIds}
          setSelectedIds={setSelectedIds}
          onNext={() => setStage("template")}
        />
      )}

      {stage === "template" && (
        <TemplateStep
          templates={approved}
          selectedId={template?.id}
          onPick={(tpl) => {
            setTemplate(tpl);
            const headN = countVars(
              tpl.components.find((c) => c.type === "HEADER")?.text,
            );
            const bodyN = countVars(
              tpl.components.find((c) => c.type === "BODY")?.text,
            );
            setVars(initVars(headN, bodyN));
            setStage("variables");
          }}
        />
      )}

      {stage === "variables" && template && (
        <VariablesStep
          template={template}
          vars={vars}
          setVars={setVars}
          onNext={() => setStage("review")}
        />
      )}

      {stage === "review" && template && (
        <ReviewStep
          template={template}
          vars={vars}
          recipients={recipients}
          onRemove={(id) => {
            const next = new Set(selectedIds);
            next.delete(id);
            setSelectedIds(next);
          }}
          scheduling={scheduling}
          setScheduling={setScheduling}
          scheduledAt={scheduledAt}
          setScheduledAt={setScheduledAt}
          onSend={send}
        />
      )}

      {stage === "sending" && (
        <SendingStep total={recipients.length} progress={progress} />
      )}

      {stage === "done" && (
        <DoneStep
          progress={progress}
          total={recipients.length}
          onReset={reset}
          onClose={() => navigate({ to: "/conversations", hash: (h) => h! })}
        />
      )}
    </div>
  );
}
