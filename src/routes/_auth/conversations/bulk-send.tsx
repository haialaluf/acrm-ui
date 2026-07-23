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
import { useMessagingLimit } from "@/queries/useMessagingLimit";
import { useOrganizationsAddresses } from "@/queries/useOrganizationsAddresses";
import { pushMessageToStore } from "@/utils/MessageUtils";
import { startConversation } from "@/utils/ConversationUtils";
import useBoundStore from "@/stores/useBoundStore";
import {
  type ContactWithAddressesRow,
  type ConversationInsert,
  type ConversationRow,
  type Json,
  type MessageInsert,
  supabase,
  type TemplateData,
} from "@/supabase/client";
import { formatPhoneNumber } from "@/utils/FormatUtils";

import WizardHeader from "@/components/bulkSend/WizardHeader";
import RecipientsStep from "@/components/bulkSend/RecipientsStep";
import TemplateStep from "@/components/bulkSend/TemplateStep";
import ManageTemplatesOverlay from "@/components/bulkSend/ManageTemplatesOverlay";
import VariablesStep from "@/components/bulkSend/VariablesStep";
import ReviewStep from "@/components/bulkSend/ReviewStep";
import SendingStep from "@/components/bulkSend/SendingStep";
import DoneStep from "@/components/bulkSend/DoneStep";
import { buildMessageRecord } from "@/components/bulkSend/buildMessageRecord";
import {
  type BatchSchedule,
  batchScheduledIso,
  computeBatches,
  countVars,
  defaultScheduledAt,
  effectiveScheduling,
  immediateCount,
  initVars,
  type ScheduleMode,
  type Scheduling,
  type Stage,
  STEP_FOR,
  type VarValue,
} from "@/components/bulkSend/types";

/**
 * Readable text for whatever `send()` caught. Supabase only wraps failures in a
 * real `PostgrestError` when the query used `.throwOnError()`; otherwise the
 * `error` field is a plain `{ message, details, hint, code }` object parsed from
 * the response body. So an `instanceof Error` check misses it and `String(e)`
 * yields "[object Object]" — which is worse than useless on the failure screen.
 * Read `message` structurally instead, and keep `details` when Postgres supplied
 * it (that is where the failing row shows up).
 */
function describeError(e: unknown): string {
  if (typeof e === "string") return e;
  if (e && typeof e === "object") {
    const { message, details } = e as { message?: unknown; details?: unknown };
    const head = typeof message === "string" && message ? message : null;
    const tail = typeof details === "string" && details ? details : null;
    if (head && tail && tail !== head) return `${head} (${tail})`;
    if (head) return head;
  }
  return String(e);
}

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
  const whatsappAddress = addresses?.find(
    (a) => a.service === "whatsapp" && a.status === "connected",
  );
  const { data: templates } = useTemplates(whatsappAddress?.address);
  const { data: messagingLimit } = useMessagingLimit(whatsappAddress?.address);
  const dailyLimit = messagingLimit?.dailyLimit ?? null;
  const approved = useMemo(
    () => (templates ?? []).filter((tpl) => tpl.status === "APPROVED"),
    [templates],
  );

  // wizard state
  const [stage, setStage] = useState<Stage>("recipients");
  // Templates management shown as an overlay over the wizard. Kept as local
  // state (not a route) so opening it never unmounts the wizard.
  // `false` = closed; otherwise the sub-view the overlay should open on.
  const [managingTemplates, setManagingTemplates] = useState<
    false | "list" | "new"
  >(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [template, setTemplate] = useState<TemplateData | null>(null);
  const [vars, setVars] = useState<Record<string, VarValue>>({});
  // Public URL for a template's mandatory media header (image/video/document).
  // Empty when the chosen template has a text/no header.
  const [headerMedia, setHeaderMedia] = useState("");
  // Default to scheduling for later, pre-filled with the next 9am (local).
  const [scheduling, setScheduling] = useState<Scheduling>("later");
  const [scheduledAt, setScheduledAt] = useState(defaultScheduledAt);
  // Per-batch scheduling for split sends. `scheduleMode` toggles the review
  // step's picker UI; `batchSchedule` holds any date/time overrides the user
  // picked, keyed by absolute batch index.
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>("auto");
  const [batchSchedule, setBatchSchedule] = useState<BatchSchedule>({});
  const [progress, setProgress] = useState({ sent: 0, failed: 0 });
  // How many messages were scheduled for later days (split sends). Surfaced on
  // the sending/done screens as "X sent today · Y scheduled".
  const [scheduled, setScheduled] = useState(0);
  // Why the send failed, when it did. The whole broadcast is one transaction, so
  // this is all-or-nothing: if it is set, nothing was written and nothing sent.
  const [sendError, setSendError] = useState<string | null>(null);

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

  /* Daily-limit batching: split the broadcast into one batch per day when it
   * exceeds the WhatsApp messaging limit fetched from Meta. */
  const overLimit = dailyLimit != null && recipients.length > dailyLimit;
  const batches = useMemo(
    () => computeBatches(recipients, dailyLimit),
    [recipients, dailyLimit],
  );
  // Recipients that go out immediately (the rest of a split send are
  // scheduled). Any batch — including batch 0 — can be pushed to a later
  // date/time via the review step's per-batch scheduler.
  const sendToday =
    effectiveScheduling(scheduling, overLimit) === "split"
      ? immediateCount(batches, batchSchedule)
      : recipients.length;

  function back() {
    if (stage === "template") setStage("recipients");
    else if (stage === "variables") setStage("template");
    else if (stage === "review") setStage("variables");
    else navigate({ to: "/conversations", hash: (h) => h! });
  }

  async function send() {
    if (!template || !whatsappAddress || !activeOrgId) return;
    const effective = effectiveScheduling(scheduling, overLimit);
    if (effective === "later" && !scheduledAt) return;

    // Resolve each recipient's send time. "now" → all immediate; "later" → all
    // at the chosen datetime; "split" → batch 0 now, each later batch scheduled
    // to the start of a following day. The existing per-record path already
    // skips the optimistic store push for future-timestamped rows.
    const items: { contact: ContactWithAddressesRow; scheduledIso?: string }[] =
      [];
    if (effective === "split") {
      for (const batch of batches) {
        // Resolve the batch's send time from the user's per-batch schedule.
        // `undefined` means it goes out now (batch 0 with no chosen time).
        const iso = batchScheduledIso(batchSchedule, batch.dayOffset);
        for (const contact of batch.list)
          items.push({ contact, scheduledIso: iso });
      }
    } else {
      const iso =
        effective === "later" && scheduledAt
          ? new Date(scheduledAt).toISOString()
          : undefined;
      for (const contact of recipients)
        items.push({ contact, scheduledIso: iso });
    }

    setStage("sending");
    setProgress({ sent: 0, failed: 0 });
    setScheduled(0);
    setSendError(null);

    // Build all records locally so we can ship them in two bulk inserts
    // (conversations + messages) instead of 2N round-trips. Existing
    // conversations are reused; new ones are optimistically added to the
    // store and queued for a single insert.
    const conversationsToInsert: ConversationInsert[] = [];
    const messageRecords: MessageInsert[] = [];
    const skipped: ContactWithAddressesRow[] = [];
    // Count records sent today vs scheduled for a later day (split sends).
    let todayCount = 0;

    const storeConvs = useBoundStore.getState().chat.conversations;

    for (const { contact, scheduledIso } of items) {
      const phone = contact.addresses?.[0]?.address;
      if (!phone) {
        skipped.push(contact);
        continue;
      }

      let conv: ConversationRow | undefined = Array.from(
        storeConvs.values(),
      ).find(
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
        headerMedia,
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
      if (!scheduledIso) {
        pushMessageToStore(record);
        todayCount++;
      }
      messageRecords.push(record);
    }

    let failed = skipped.length;
    try {
      if (messageRecords.length) {
        // One transaction for both tables. Writing them as two requests could
        // half-succeed — on 2026-07-23 the conversations landed, the messages
        // failed, and the org was left with 1084 orphan conversations and
        // nothing sent. All-or-nothing also makes a retry after a failure safe,
        // since there is never a partially-sent broadcast to duplicate.
        //
        // The RPC omits defaulted columns rather than sending them as NULL,
        // which is what broke split sends here: postgrest-js derives `columns`
        // from the *union* of the records' keys and writes NULL for every key a
        // record is missing, so immediate rows (no `timestamp` — the column
        // default `now()` should apply) mixed with scheduled ones (explicit
        // `timestamp`) violated the not-null constraint and took the whole
        // broadcast down.
        const { error } = await supabase.rpc("send_broadcast", {
          _conversations: conversationsToInsert as unknown as Json,
          _messages: messageRecords as unknown as Json,
        });
        if (error) throw error;
      }
      setProgress({ sent: todayCount, failed });
      setScheduled(messageRecords.length - todayCount);
    } catch (e) {
      console.error("bulk-send failed", e);
      setSendError(describeError(e));
      failed += messageRecords.length;
      setProgress({ sent: 0, failed });
      setScheduled(0);
    }

    setStage("done");
  }

  function reset() {
    setStage("recipients");
    setSelectedIds(new Set());
    setTemplate(null);
    setVars({});
    setHeaderMedia("");
    setScheduling("later");
    setScheduledAt(defaultScheduledAt());
    setScheduleMode("auto");
    setBatchSchedule({});
    setProgress({ sent: 0, failed: 0 });
    setScheduled(0);
    setSendError(null);
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
          subtitle: `${recipients.length} ${t(
            "destinatarios",
          )} · ${template?.name}`,
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
          title: sendError ? t("No se pudo enviar") : t("Envío completado"),
          subtitle: template?.name,
          step,
          showProgress: false,
        };
    }
  })();

  return (
    <div className="relative flex flex-col h-full">
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
          dailyLimit={dailyLimit}
          tier={messagingLimit?.tier}
        />
      )}

      {stage === "template" && (
        <TemplateStep
          templates={approved}
          selectedId={template?.id}
          onManage={
            whatsappAddress ? () => setManagingTemplates("list") : undefined
          }
          onCreate={
            whatsappAddress ? () => setManagingTemplates("new") : undefined
          }
          onPick={(tpl) => {
            setTemplate(tpl);
            const headN = countVars(
              tpl.components.find((c) => c.type === "HEADER")?.text,
            );
            const bodyN = countVars(
              tpl.components.find((c) => c.type === "BODY")?.text,
            );
            setVars(initVars(headN, bodyN));
            setHeaderMedia("");
            setStage("variables");
          }}
        />
      )}

      {stage === "variables" && template && (
        <VariablesStep
          template={template}
          vars={vars}
          setVars={setVars}
          headerMedia={headerMedia}
          setHeaderMedia={setHeaderMedia}
          onNext={() => setStage("review")}
        />
      )}

      {stage === "review" && template && (
        <ReviewStep
          template={template}
          vars={vars}
          headerMedia={headerMedia}
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
          dailyLimit={dailyLimit}
          tier={messagingLimit?.tier}
          batches={batches}
          batchSchedule={batchSchedule}
          setBatchSchedule={setBatchSchedule}
          scheduleMode={scheduleMode}
          setScheduleMode={setScheduleMode}
        />
      )}

      {stage === "sending" && (
        <SendingStep
          total={sendToday}
          progress={progress}
          scheduled={scheduled}
        />
      )}

      {stage === "done" && (
        <DoneStep
          progress={progress}
          total={sendToday}
          scheduled={scheduled}
          error={sendError}
          onReset={reset}
          onRetry={() => setStage("review")}
          onClose={() => navigate({ to: "/conversations", hash: (h) => h! })}
        />
      )}

      {managingTemplates && whatsappAddress && (
        <ManageTemplatesOverlay
          organizationAddress={whatsappAddress.address}
          initialMode={managingTemplates}
          onClose={() => setManagingTemplates(false)}
        />
      )}
    </div>
  );
}
