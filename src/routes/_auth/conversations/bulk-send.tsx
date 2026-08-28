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
import {
  useEmailTemplate,
  useEmailTemplates,
} from "@/queries/useEmailTemplates";
import { useMintUnsubscribeLinks } from "@/queries/useUnsubscribeLinks";
import { useMessagingLimit } from "@/queries/useMessagingLimit";
import { useIntegrations } from "@/hooks/useIntegrations";
import { useOutboundChannels } from "@/hooks/useAccess";
import IntegrationGate from "@/components/IntegrationGate";
import { pushMessageToStore } from "@/utils/MessageUtils";
import { startConversation } from "@/utils/ConversationUtils";
import useBoundStore from "@/stores/useBoundStore";
import {
  type ConversationInsert,
  type ConversationRow,
  type EmailOrganizationAddressExtra,
  type EmailTemplateExtra,
  type Json,
  type MessageInsert,
  supabase,
  type TemplateData,
} from "@/supabase/client";
import { contactPhone } from "@/utils/ContactAddressUtils";
import { formatPhoneNumber } from "@/utils/FormatUtils";

import WizardHeader from "@/components/bulkSend/WizardHeader";
import RecipientsStep from "@/components/bulkSend/RecipientsStep";
import TemplateStep from "@/components/bulkSend/TemplateStep";
import ManageTemplatesOverlay from "@/components/bulkSend/ManageTemplatesOverlay";
import VariablesStep from "@/components/bulkSend/VariablesStep";
import EmailVariablesStep from "@/components/bulkSend/EmailVariablesStep";
import ReviewStep from "@/components/bulkSend/ReviewStep";
import SendingStep from "@/components/bulkSend/SendingStep";
import DoneStep from "@/components/bulkSend/DoneStep";
import { buildMessageRecord } from "@/components/bulkSend/buildMessageRecord";
import { buildEmailMessageRecord } from "@/components/bulkSend/buildEmailMessageRecord";
import { bookingButtonIndex } from "@/components/templateButtons";
import { useCalendars } from "@/queries/useCalendars";
import {
  DEFAULT_BOOKING_DURATION,
  useMintBookingLinks,
} from "@/queries/useBookingLinks";
import {
  applyEmailOverrides,
  type BatchSchedule,
  batchScheduledIso,
  type Channel,
  computeBatches,
  countVars,
  defaultScheduledAt,
  effectiveScheduling,
  type EmailVarOverrides,
  expandRecipients,
  immediateCount,
  initVars,
  type Recipient,
  recipientContactIds,
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
  component: () => (
    <IntegrationGate surface="/conversations/bulk-send">
      <BulkSendWizard />
    </IntegrationGate>
  ),
  validateSearch: (raw: Record<string, unknown>): BulkSendSearch => ({
    contactId: typeof raw.contactId === "string" ? raw.contactId : undefined,
    templateId: typeof raw.templateId === "string" ? raw.templateId : undefined,
  }),
});

// A separate component so the gate decides before any of this mounts:
// the body's queries and early returns never run for an organization
// that is about to be redirected.
function BulkSendWizard() {
  const { translate: t } = useTranslation();
  const navigate = useNavigate();
  const { contactId: prefillContactId, templateId: prefillTemplateId } =
    useSearch({ from: "/_auth/conversations/bulk-send" });
  const activeOrgId = useBoundStore((s) => s.ui.activeOrgId);
  const { data: agent } = useCurrentAgent();
  const agentId = agent?.id;
  const { data: contacts } = useContacts();
  const { rows: connectedAddresses } = useIntegrations();
  const whatsappAddress = connectedAddresses.whatsapp;
  // A verified sending domain. Email templates point at one by name, so this is
  // both the "can this org send email at all" test and where the From address
  // and SES wiring come from.
  const emailAddress = connectedAddresses.email;
  const { data: templates, isPending: loadingTemplates } = useTemplates(
    whatsappAddress?.address,
  );
  const {
    data: emailTemplateList,
    isPending: loadingEmailTemplates,
    error: emailTemplatesError,
  } = useEmailTemplates();
  const { data: messagingLimit } = useMessagingLimit(whatsappAddress?.address);
  const approved = useMemo(
    () => (templates ?? []).filter((tpl) => tpl.status === "APPROVED"),
    [templates],
  );
  // Only `live` templates on a domain this org has actually connected. A draft
  // is unfinished by definition, and a template whose domain was disconnected
  // has nowhere to send from — its `organization_address` was set to null by
  // the FK.
  const sendableEmailTemplates = useMemo(
    () =>
      (emailTemplateList ?? []).filter(
        (tpl) =>
          tpl.status === "live" &&
          !!tpl.organization_address &&
          tpl.organization_address === emailAddress?.address,
      ),
    [emailTemplateList, emailAddress],
  );
  const { data: calendars, isPending: loadingCalendars } = useCalendars();
  const mintBookingLinks = useMintBookingLinks();
  const mintUnsubscribeLinks = useMintUnsubscribeLinks();

  // wizard state
  const [stage, setStage] = useState<Stage>("template");
  // Templates management shown as an overlay over the wizard. Kept as local
  // state (not a route) so opening it never unmounts the wizard.
  // `false` = closed; otherwise the sub-view the overlay should open on.
  const [managingTemplates, setManagingTemplates] = useState<
    false | "list" | "new"
  >(false);
  // Selected ADDRESSES, not contact ids: the recipients step lists one row per
  // address, so a contact with two phone numbers can be sent to on both (or on
  // just one). Addresses are unique org-wide — they are `contacts_addresses`'
  // primary key — so they key the selection on their own.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [template, setTemplate] = useState<TemplateData | null>(null);
  const [vars, setVars] = useState<Record<string, VarValue>>({});
  /* Which channels this organization can broadcast on at all — the same list
   * the templates section and the nav rail read, so the three cannot drift
   * apart on what "you can send" means. */
  const { channels: available } = useOutboundChannels();
  // Email arm. `channel` is set by whichever list the step-1 pick came from,
  // and from then on decides who is selectable, which variables UI runs and
  // which preview the review step draws.
  //
  // Derived rather than defaulted-then-corrected: this wizard only mounts
  // inside `IntegrationGate`, so at least one channel is connected by now and
  // `available[0]` is real. Starting at "whatsapp" and fixing it in an effect
  // rendered one frame of the WhatsApp list to an email-only organization.
  const [channel, setChannel] = useState<Channel>(
    () => available[0] ?? "whatsapp",
  );
  const [emailTemplateId, setEmailTemplateId] = useState<string | null>(null);
  // The list only carries summaries; the compiled HTML the preview and the send
  // both need lives on the detail row.
  const { data: emailTemplate } = useEmailTemplate(
    emailTemplateId ?? undefined,
  );
  const [emailVars, setEmailVars] = useState<EmailVarOverrides>({});
  // Signed URL for a template's mandatory media header (image/video/document),
  // plus the picked file's name for display only. Empty when the chosen
  // template has a text/no header. Always set together — see `pickHeaderMedia`.
  const [headerMedia, setHeaderMedia] = useState("");
  const [headerMediaName, setHeaderMediaName] = useState("");
  // Byte size of the picked document, for the preview's "PDF · 21 KB" sub-line.
  // Undefined when unknown (e.g. the "use template example" shortcut).
  const [headerMediaSize, setHeaderMediaSize] = useState<number | undefined>();
  const pickHeaderMedia = (url: string, name: string, size?: number) => {
    setHeaderMedia(url);
    setHeaderMediaName(name);
    setHeaderMediaSize(size);
  };
  // Which calendar a booking-link template books against, and how long the
  // appointment it offers runs. Both are properties of the minted link rather
  // than of the template, so they are asked for per broadcast — see
  // `bookingCalendarId` below.
  const [pickedCalendarId, setPickedCalendarId] = useState("");
  const [bookingDuration, setBookingDuration] = useState(
    DEFAULT_BOOKING_DURATION,
  );
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

  /* The From address, resolved at queue time rather than at dispatch.
   *
   * It is snapshotted onto every message so that changing the domain's default
   * sender, or the template's `from_name`, cannot retarget mail that is already
   * queued. `default_from_address` is set on the domain detail page once the
   * domain verifies, and validated server-side to be at that domain — until
   * someone does, there is no legitimate address to send from and the review
   * step blocks. */
  const emailFrom = useMemo(() => {
    const extra = emailAddress?.extra as EmailOrganizationAddressExtra | null;
    if (!extra?.default_from_address) return null;

    return {
      address: extra.default_from_address,
      // The template may override the domain-wide display name — a newsletter
      // and a receipt can legitimately come from "Acme News" and "Acme".
      name:
        (emailTemplate?.extra as EmailTemplateExtra | null)?.from_name ||
        extra.default_from_name ||
        undefined,
    };
  }, [emailAddress, emailTemplate]);

  // Prefill once data is loaded. Guarded so we don't re-apply if the user
  // navigates back inside the wizard. WhatsApp-only: the entry points that use
  // it (TemplatePicker, opened from inside a conversation) are chat surfaces.
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
    // The prefill comes from a conversation, so there is a number — but it is
    // the address, not the contact, that the selection is keyed by.
    const phone = contactPhone(contact);
    if (!phone) return;
    appliedPrefillRef.current = true;
    setChannel("whatsapp");
    setSelectedIds(new Set([phone]));
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

  /* Resolved recipients — one per selected ADDRESS on the chosen channel.
   *
   * Re-expanding the contacts rather than trusting the selection alone keeps
   * a stale pick out of the send: an address deleted after it was ticked, or a
   * selection carried over a channel switch, simply has no row to match. A
   * contact selected on two of their numbers yields two recipients here, and
   * two copies at send time. */
  const recipients = useMemo<Recipient[]>(
    () =>
      expandRecipients(contacts ?? [], channel).filter((r) =>
        selectedIds.has(r.address),
      ),
    [contacts, selectedIds, channel],
  );

  /* Self-service booking links. A template carries them by pointing a dynamic
   * URL button at the booking site; when one does, every recipient needs their
   * OWN token in that button's parameter. Minting needs a calendar and an
   * appointment length, both asked for on the review step — except that a lone
   * calendar is pre-selected, since there is nothing to choose between. */
  const bookingIndex = template ? bookingButtonIndex(template) : null;
  const bookingCalendarId =
    bookingIndex == null
      ? null
      : pickedCalendarId ||
        (calendars?.length === 1 ? calendars[0].id : "") ||
        null;

  /* Daily-limit batching: split the broadcast into one batch per day when it
   * exceeds the WhatsApp messaging limit fetched from Meta.
   *
   * Null for email — the messaging limit is a Meta tier, a property of a phone
   * number, with no email equivalent. A null limit makes `computeBatches` yield
   * a single batch and takes the "split over days" option off the review step,
   * which is the correct behaviour rather than a missing feature. */
  const dailyLimit =
    channel === "email" ? null : (messagingLimit?.dailyLimit ?? null);
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
    if (stage === "recipients") setStage("template");
    else if (stage === "variables") setStage("recipients");
    else if (stage === "review") setStage("variables");
    else navigate({ to: "/conversations", hash: (h) => h! });
  }

  async function send() {
    if (!activeOrgId) return;
    if (channel === "email" ? !emailTemplate : !template || !whatsappAddress) {
      return;
    }
    const effective = effectiveScheduling(scheduling, overLimit);
    if (effective === "later" && !scheduledAt) return;

    // Resolve each recipient's send time. "now" → all immediate; "later" → all
    // at the chosen datetime; "split" → batch 0 now, each later batch scheduled
    // to the start of a following day. The existing per-record path already
    // skips the optimistic store push for future-timestamped rows.
    const items: { recipient: Recipient; scheduledIso?: string }[] = [];
    if (effective === "split") {
      for (const batch of batches) {
        // Resolve the batch's send time from the user's per-batch schedule.
        // `undefined` means it goes out now (batch 0 with no chosen time).
        const iso = batchScheduledIso(batchSchedule, batch.dayOffset);
        for (const recipient of batch.list)
          items.push({ recipient, scheduledIso: iso });
      }
    } else {
      const iso =
        effective === "later" && scheduledAt
          ? new Date(scheduledAt).toISOString()
          : undefined;
      for (const recipient of recipients)
        items.push({ recipient, scheduledIso: iso });
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
    const skipped: Recipient[] = [];
    // Count records sent today vs scheduled for a later day (split sends).
    let todayCount = 0;

    // One mint for the entire broadcast: 500 recipients cost a single extra
    // round-trip, and anyone who already holds a live link gets that same link
    // back (with its expiry pushed out) rather than a second one.
    let bookingTokens = new Map<string, string>();
    if (channel === "whatsapp" && bookingIndex != null && bookingCalendarId) {
      try {
        bookingTokens = await mintBookingLinks.mutateAsync({
          calendarId: bookingCalendarId,
          // Deduped: someone selected on two of their numbers still needs one
          // token, and the same link goes in both copies.
          contactIds: recipientContactIds(recipients),
          durationMinutes: bookingDuration,
        });
      } catch (e) {
        // Without tokens every recipient would receive the template's example
        // link — one shared URL pointing at somebody else's booking page — so
        // fail the send instead.
        console.error("minting booking links failed", e);
        setSendError(describeError(e));
        setProgress({ sent: 0, failed: recipients.length });
        setStage("done");
        return;
      }
    }

    // The email counterpart, and the same all-or-nothing rule. The dispatcher
    // will mint any token this misses (ensure_unsubscribe_link), so the reason
    // to do it here is not correctness but cost: one round-trip for the whole
    // campaign instead of one query per recipient at send time. A failure still
    // aborts — a broadcast whose opt-out links cannot be created is one that
    // should not go out.
    if (channel === "email") {
      try {
        await mintUnsubscribeLinks.mutateAsync({
          contactIds: recipientContactIds(recipients),
        });
      } catch (e) {
        console.error("minting unsubscribe links failed", e);
        setSendError(describeError(e));
        setProgress({ sent: 0, failed: recipients.length });
        setStage("done");
        return;
      }
    }

    const storeConvs = useBoundStore.getState().chat.conversations;

    // Both channels write a conversation per recipient, because
    // messages.conversation_id is NOT NULL. For email that means the contact's
    // timeline shows what they were sent, on the same footing as their chats.
    const orgAddress =
      channel === "email" ? emailAddress!.address : whatsappAddress!.address;

    for (const { recipient, scheduledIso } of items) {
      // The address is the recipient — not "the contact's phone", which would
      // collapse both of a two-number contact's rows onto whichever one came
      // first and send them the same message twice.
      const { contact, address } = recipient;

      let conv: ConversationRow | undefined = Array.from(
        storeConvs.values(),
      ).find(
        (c) =>
          c.organization_address === orgAddress &&
          c.contact_address === address,
      );

      if (!conv) {
        const record = startConversation({
          organization_id: activeOrgId,
          organization_address: orgAddress,
          contact_address: address,
          service: channel,
          name:
            contact.name ||
            (channel === "email" ? address : formatPhoneNumber(address)),
        });
        conv = useBoundStore.getState().chat.conversations.get(record.id!);
        if (!conv) {
          skipped.push(recipient);
          continue;
        }
        if (!conv.updated_at) {
          conversationsToInsert.push(conv);
        }
      }

      const record =
        channel === "email"
          ? buildEmailMessageRecord({
              contact,
              conv,
              template: emailTemplate!,
              variables: applyEmailOverrides(
                emailTemplate!.variables,
                emailVars,
              ),
              from: emailFrom!,
              replyTo: (emailTemplate!.extra as EmailTemplateExtra | null)
                ?.reply_to,
              agentId,
              scheduledAt: scheduledIso,
            })
          : buildMessageRecord({
              contact,
              conv,
              template: template!,
              vars,
              headerMedia,
              agentId,
              scheduledAt: scheduledIso,
              bookingToken: bookingTokens.get(contact.id),
            });
      if (!record) {
        skipped.push(recipient);
        continue;
      }
      // Skip optimistic push for scheduled messages — the chat only shows
      // messages whose timestamp has passed, and `pushMessageToStore` stamps
      // the optimistic copy with `now`, so a scheduled send would flicker into
      // the conversation and disappear once the server row syncs back.
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
    setStage("template");
    setSelectedIds(new Set());
    setTemplate(null);
    setVars({});
    setEmailTemplateId(null);
    setEmailVars({});
    pickHeaderMedia("", "");
    setPickedCalendarId("");
    setBookingDuration(DEFAULT_BOOKING_DURATION);
    setScheduling("later");
    setScheduledAt(defaultScheduledAt());
    setScheduleMode("auto");
    setBatchSchedule({});
    setProgress({ sent: 0, failed: 0 });
    setScheduled(0);
    setSendError(null);
  }

  // Whichever channel's template is in play, for the header subtitles.
  const templateName =
    channel === "email" ? emailTemplate?.name : template?.name;

  // Header content varies by stage.
  const header = (() => {
    const step = STEP_FOR[stage];
    switch (stage) {
      case "template":
        return {
          title: t("Choose a template"),
          subtitle: t("This decides who you can send to"),
          step,
          showProgress: true,
        };
      case "recipients":
        return {
          title: t("Choose recipients"),
          subtitle: templateName,
          step,
          showProgress: true,
        };
      case "variables":
        return {
          title: t("Variables"),
          subtitle: templateName,
          step,
          showProgress: true,
        };
      case "review":
        return {
          title: t("Preview and send"),
          subtitle: `${recipients.length} ${t("recipients")} · ${templateName}`,
          step,
          showProgress: true,
        };
      case "sending":
        return {
          title: t("Sending…"),
          subtitle: templateName,
          step,
          showProgress: false,
        };
      case "done":
        return {
          title: sendError ? t("Could not send") : t("Sending completed"),
          subtitle: templateName,
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

      {stage === "template" && (
        <TemplateStep
          channel={channel}
          onChannel={(next) => {
            setChannel(next);
            // Switching channel invalidates any selection made for the other
            // one: reachability differs, so keeping it would silently drop
            // whoever is unreachable on the new channel at send time.
            setSelectedIds(new Set());
          }}
          available={available}
          whatsapp={{
            templates: approved,
            isLoading: loadingTemplates,
            onManage: whatsappAddress
              ? () => setManagingTemplates("list")
              : undefined,
            onCreate: whatsappAddress
              ? () => setManagingTemplates("new")
              : undefined,
            onPick: (tpl) => {
              setChannel("whatsapp");
              setTemplate(tpl);
              const headN = countVars(
                tpl.components.find((c) => c.type === "HEADER")?.text,
              );
              const bodyN = countVars(
                tpl.components.find((c) => c.type === "BODY")?.text,
              );
              setVars(initVars(headN, bodyN));
              pickHeaderMedia("", "");
              setStage("recipients");
            },
          }}
          email={{
            templates: sendableEmailTemplates,
            isLoading: loadingEmailTemplates,
            error: emailTemplatesError as Error | null,
            onCreate: () => navigate({ to: "/templates/email/new" }),
            onPick: (tpl) => {
              setChannel("email");
              setEmailTemplateId(tpl.id);
              // Bindings come from the template; only per-send fallback
              // overrides are collected, and they start empty.
              setEmailVars({});
              setStage("recipients");
            },
          }}
        />
      )}

      {stage === "recipients" && (
        <RecipientsStep
          channel={channel}
          selectedIds={selectedIds}
          setSelectedIds={setSelectedIds}
          onNext={() => setStage("variables")}
          dailyLimit={dailyLimit}
          tier={messagingLimit?.tier}
        />
      )}

      {stage === "variables" && channel === "whatsapp" && template && (
        <VariablesStep
          template={template}
          vars={vars}
          setVars={setVars}
          headerMedia={headerMedia}
          headerMediaName={headerMediaName}
          headerMediaSize={headerMediaSize}
          setHeaderMedia={pickHeaderMedia}
          onNext={() => setStage("review")}
        />
      )}

      {stage === "variables" && channel === "email" && emailTemplate && (
        <EmailVariablesStep
          template={emailTemplate}
          overrides={emailVars}
          setOverrides={setEmailVars}
          onNext={() => setStage("review")}
        />
      )}

      {stage === "review" &&
        (channel === "email" ? emailTemplate : template) && (
          <ReviewStep
            channel={channel}
            template={template ?? undefined}
            email={
              channel === "email" && emailTemplate
                ? {
                    template: emailTemplate,
                    variables: applyEmailOverrides(
                      emailTemplate.variables,
                      emailVars,
                    ),
                    from: emailFrom,
                  }
                : undefined
            }
            vars={vars}
            headerMedia={headerMedia}
            headerMediaName={headerMediaName}
            headerMediaSize={headerMediaSize}
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
            booking={
              bookingIndex == null
                ? undefined
                : {
                    calendars: (calendars ?? []).map((c) => ({
                      id: c.id,
                      name: c.name,
                    })),
                    calendarsLoading: loadingCalendars,
                    calendarId: bookingCalendarId ?? "",
                    setCalendarId: setPickedCalendarId,
                    duration: bookingDuration,
                    setDuration: setBookingDuration,
                  }
            }
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
