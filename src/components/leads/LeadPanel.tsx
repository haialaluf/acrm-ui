import { useContext, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Clock,
  MessageCircle,
  Phone,
  Send,
  Undo2,
  X,
} from "lucide-react";
import { TickContext } from "@/contexts/useTick";
import { useTranslation } from "@/hooks/useTranslation";
import { useCurrentAgent } from "@/queries/useAgents";
import { useAddContactNote, useContactNotes } from "@/queries/useContactNotes";
import { useOrganizationsAddresses } from "@/queries/useOrganizationsAddresses";
import { useMergedSubmissions, type PipelineLead } from "@/queries/useLeads";
import type { LeadFlow, LeadNext, LeadStage } from "@/supabase/client";
import { contactThreadKey } from "@/utils/ConversationUtils";
import { formatPhoneNumber, ltrIsolate } from "@/utils/FormatUtils";
import {
  addFromNow,
  dueState,
  isOpenPhase,
  NEXT_TYPE_LABELS,
  offeredOutcomes,
  stageOf,
  stageToneStyle,
} from "@/utils/leads";
import {
  Btn,
  IconBtn,
  Label,
  NEXT_TYPE_ICONS,
  OutcomeIcon,
  useFormatAgo,
  useFormatWhen,
} from "./LeadBits";
import { LeadAvatar, leadName, leadPhone } from "./LeadList";
import OutcomeForm, {
  type OutcomeIntent,
  type OutcomeSubmit,
} from "./OutcomeForm";

const SOURCE_LABELS: Record<string, string> = {
  facebook_lead: "Facebook · lead form",
  instagram_lead: "Instagram · lead form",
  api_lead: "API",
  manual: "Added by hand",
};

export function StageTrack({
  flow,
  stageId,
  onMove,
}: {
  flow: LeadFlow;
  stageId: string | null;
  onMove: (stageId: string) => void;
}) {
  const { translate: t } = useTranslation();
  const main = flow.stages.filter((s) => isOpenPhase(s.phase));
  const ends = flow.stages.filter((s) => !isOpenPhase(s.phase));
  const index = main.findIndex((s) => s.id === stageId);

  return (
    <div className="flex items-stretch gap-[10px] flex-wrap">
      <div className="flex grow gap-[3px] min-w-[min(280px,100%)] overflow-x-auto">
        {main.map((s, i) => {
          const current = s.id === stageId;
          const past = index >= 0 && i < index;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => !current && onMove(s.id)}
              title={current ? t("Current stage") : s.name}
              style={stageToneStyle(s)}
              className={`stage-tone grow basis-0 h-[30px] px-[8px] text-[12px] truncate first:rounded-s-full last:rounded-e-full transition-colors ${
                current
                  ? "bg-[var(--stage-dot)] text-white font-semibold cursor-default"
                  : past
                    ? "bg-[var(--stage-line)] text-[var(--stage-fg)]"
                    : "bg-muted text-muted-foreground hover:brightness-95"
              }`}
            >
              {s.name}
            </button>
          );
        })}
      </div>
      <div className="flex gap-[6px]">
        {ends.map((s) => {
          const current = s.id === stageId;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => !current && onMove(s.id)}
              style={stageToneStyle(s)}
              className={`stage-tone inline-flex items-center gap-[6px] rounded-full text-[12px] h-[30px] px-[12px] border ${
                current
                  ? "border-[var(--stage-dot)] bg-[var(--stage-bg)] text-[var(--stage-fg)]"
                  : "border-border bg-background text-foreground"
              }`}
            >
              <span className="w-[7px] h-[7px] rounded-full bg-[var(--stage-dot)]" />
              {s.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function OutcomeGrid({
  flow,
  onPick,
}: {
  flow: LeadFlow;
  onPick: (intent: OutcomeIntent) => void;
}) {
  return (
    <div className="grid gap-[8px] grid-cols-[repeat(auto-fill,minmax(132px,1fr))]">
      {offeredOutcomes(flow).map((outcome) => {
        const to = stageOf(flow, outcome.to_stage);
        return (
          <button
            key={outcome.id}
            type="button"
            onClick={() => onPick({ outcome })}
            className="flex flex-col items-start gap-[8px] rounded-xl p-[12px] text-start border border-border bg-background hover:border-primary hover:bg-primary/5 active:scale-[.98] transition"
          >
            <span
              style={stageToneStyle(to)}
              className={`stage-tone w-[30px] h-[30px] rounded-lg flex items-center justify-center ${
                to ? "bg-[var(--stage-bg)] text-[var(--stage-fg)]" : "bg-muted"
              }`}
            >
              <OutcomeIcon name={outcome.icon} className="w-[16px] h-[16px]" />
            </span>
            <span className="text-[14px] font-medium">{outcome.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function DetailRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: string | null | undefined;
  strong?: boolean;
}) {
  if (!value) return null;
  return (
    <div className="flex items-baseline gap-[14px] py-[8px] border-t border-border">
      <div className="text-[13px] w-[92px] shrink-0 text-muted-foreground">
        {label}
      </div>
      <div
        className={`text-[14px] grow min-w-0 break-words ${strong ? "font-semibold" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}

function NextCard({
  lead,
  onSnooze,
}: {
  lead: PipelineLead;
  onSnooze: (next: LeadNext) => void;
}) {
  const { translate: t } = useTranslation();
  const now = useContext(TickContext);
  const when = useFormatWhen();
  const p = lead.pipeline;
  const due = dueState(p.next, now);
  const overdue = due === "overdue";
  const Icon = p.next ? NEXT_TYPE_ICONS[p.next.type] : AlertCircle;

  return (
    <div
      className={`flex items-center gap-[12px] rounded-2xl px-[16px] py-[14px] ${
        overdue ? "bg-destructive/10" : "bg-accent"
      }`}
    >
      <span className="w-[38px] h-[38px] rounded-full flex items-center justify-center shrink-0 bg-background">
        <Icon
          className={`w-[18px] h-[18px] ${overdue ? "text-destructive" : "text-primary"}`}
        />
      </span>
      <div className="grow min-w-0">
        <div className="text-[12px] text-muted-foreground">
          {t("Next step")}
        </div>
        <div
          className={`text-[16px] font-semibold ${overdue ? "text-destructive" : ""}`}
        >
          {p.next
            ? `${t(NEXT_TYPE_LABELS[p.next.type])} · ${overdue ? t("Overdue") + ", " : ""}${when(p.next.at)}`
            : p.phase === "new" && !p.attempts
              ? t("First call - now")
              : t("No next step set")}
        </div>
      </div>
      {p.next && (
        <div className="flex gap-[4px] flex-wrap justify-end">
          {(
            [
              ["1h", t("An hour")],
              ["1d", t("Tomorrow")],
            ] as const
          ).map(([spec, label]) => (
            <Btn
              key={spec}
              className="h-[30px] text-[13px] px-[10px]"
              onClick={() =>
                onSnooze({
                  type: p.next!.type,
                  at: addFromNow(spec, now, new Date(p.next!.at).getHours())!,
                })
              }
            >
              <Clock className="w-[13px] h-[13px]" />
              {label}
            </Btn>
          ))}
        </div>
      )}
    </div>
  );
}

function History({ lead }: { lead: PipelineLead }) {
  const { translate: t } = useTranslation();
  const ago = useFormatAgo();
  const { data: me } = useCurrentAgent();
  const contactId = lead.contact_id ?? "";
  const { data: notes } = useContactNotes(contactId);
  const addNote = useAddContactNote(contactId);
  const [draft, setDraft] = useState("");

  function add() {
    const body = draft.trim();
    if (!body || !me) return;
    addNote.mutate(
      { organizationId: me.organization_id, agentId: me.id, body },
      { onSuccess: () => setDraft("") },
    );
  }

  if (!lead.contact_id) return null;

  return (
    <div>
      <Label>{t("History")}</Label>
      <div className="flex items-center gap-[8px] rounded-full ps-[14px] pe-[4px] mb-[16px] h-[42px] border border-border">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder={t("Add a note…")}
          className="grow bg-transparent outline-none text-[15px]"
        />
        <IconBtn
          onClick={add}
          disabled={!draft.trim() || addNote.isPending}
          className={
            draft.trim()
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : ""
          }
        >
          <Send className="w-[15px] h-[15px] send-icon" />
        </IconBtn>
      </div>
      <div className="flex flex-col">
        {(notes ?? []).map((note) => (
          <div key={note.id} className="pb-[14px]">
            <div className="flex items-center gap-[8px] text-[12px] text-muted-foreground">
              {note.agent?.name && (
                <span className="text-foreground font-medium">
                  {note.agent.name}
                </span>
              )}
              <span>{ago(note.created_at)}</span>
            </div>
            <div className="text-[14px] mt-[3px] leading-relaxed whitespace-pre-wrap">
              {note.body}
            </div>
          </div>
        ))}
        <div className="text-[12px] text-muted-foreground">
          {t("Came in")} {ago(lead.created_time)}
        </div>
      </div>
    </div>
  );
}

export default function LeadPanel({
  flow,
  lead,
  queueMode,
  onBack,
  onClose,
  initialIntent,
  saving,
  error,
  onSubmit,
  onSnooze,
}: {
  flow: LeadFlow;
  lead: PipelineLead | undefined;
  queueMode: boolean;
  onBack?: () => void;
  onClose?: () => void;
  initialIntent?: OutcomeIntent | null;
  saving: boolean;
  error: string | null;
  onSubmit: (lead: PipelineLead, submit: OutcomeSubmit) => Promise<boolean>;
  onSnooze: (lead: PipelineLead, next: LeadNext) => void;
}) {
  const { translate: t } = useTranslation();
  const ago = useFormatAgo();
  const { data: orgAddresses } = useOrganizationsAddresses();
  const { data: merged } = useMergedSubmissions(lead?.leadgen_id);
  const [intent, setIntent] = useState<OutcomeIntent | null>(
    initialIntent ?? null,
  );
  const [intentLead, setIntentLead] = useState(lead?.leadgen_id);

  if (lead?.leadgen_id !== intentLead) {
    setIntentLead(lead?.leadgen_id);
    setIntent(initialIntent ?? null);
  }

  if (!lead) {
    return (
      <div className="h-full bg-chat flex items-center justify-center text-[14px] text-muted-foreground">
        {t("Pick a lead to work on")}
      </div>
    );
  }

  const p = lead.pipeline;
  const stage: LeadStage | undefined = stageOf(flow, p.stage);
  const phone = leadPhone(lead);
  const email = lead.contact?.addresses.find(
    (a) => a.service === "email",
  )?.address;
  const whatsapp = orgAddresses?.find(
    (a) => a.service === "whatsapp" && a.status === "connected",
  );
  const customFields = flow.fields.filter(
    (f) => p.fields[f.id] != null && p.fields[f.id] !== "",
  );
  const answers = Object.entries(p.answers ?? {});
  const openFirstStage = flow.stages.find((s) => s.phase === "open");

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="flex items-center gap-[12px] px-[16px] h-[72px] shrink-0 border-b border-border">
        {onClose && (
          <IconBtn onClick={onClose} title={t("Close")}>
            <X className="w-[19px] h-[19px]" />
          </IconBtn>
        )}
        {onBack && (
          <IconBtn onClick={onBack} title={t("Back")} className="md:hidden">
            <ArrowLeft className="w-[21px] h-[21px]" />
          </IconBtn>
        )}
        <LeadAvatar lead={lead} size={44} />
        <div className="min-w-0 grow">
          {lead.contact_id ? (
            <Link
              to="/contacts/$contactId"
              params={{ contactId: lead.contact_id }}
              className="text-[17px] truncate block text-foreground hover:underline"
            >
              {leadName(lead)}
            </Link>
          ) : (
            <div className="text-[17px] truncate">{leadName(lead)}</div>
          )}
          <div className="text-[13px] truncate text-muted-foreground">
            {phone && ltrIsolate(formatPhoneNumber(phone))}
            {email && <span className="hidden md:inline"> · {email}</span>}
          </div>
        </div>
        {phone && (
          <a
            href={`tel:+${phone}`}
            title={t("Call")}
            className="w-[40px] h-[40px] rounded-full inline-flex items-center justify-center border border-border text-foreground hover:bg-muted shrink-0"
          >
            <Phone className="w-[18px] h-[18px]" />
          </a>
        )}
        {phone && whatsapp && (
          <Link
            to="/conversations"
            hash={contactThreadKey(whatsapp.address, phone)}
            title={t("Open conversation")}
            className="w-[40px] h-[40px] rounded-full inline-flex items-center justify-center bg-primary text-primary-foreground hover:bg-primary/90 shrink-0"
          >
            <MessageCircle className="w-[18px] h-[18px]" />
          </Link>
        )}
      </div>

      <div className="grow overflow-y-auto @container">
        <div className="grid grid-cols-1 @[780px]:grid-cols-[minmax(0,1fr)_300px]">
          <div className="flex flex-col gap-[22px] p-[20px] min-w-0">
            <StageTrack
              flow={flow}
              stageId={p.stage}
              onMove={(toStage) => setIntent({ toStage })}
            />

            {isOpenPhase(p.phase) && (
              <NextCard lead={lead} onSnooze={(next) => onSnooze(lead, next)} />
            )}

            {!isOpenPhase(p.phase) && stage && (
              <div
                style={stageToneStyle(stage)}
                className="stage-tone flex items-center gap-[12px] rounded-2xl px-[16px] py-[14px] bg-[var(--stage-bg)] text-[var(--stage-fg)]"
              >
                {p.phase === "won" ? (
                  <Check className="w-[18px] h-[18px]" />
                ) : (
                  <X className="w-[18px] h-[18px]" />
                )}
                <div className="grow text-[15px]">
                  {p.phase === "won"
                    ? t("The lead became a customer")
                    : t("The lead was released")}{" "}
                  · {ago(p.stage_since)}
                </div>
                {openFirstStage && (
                  <Btn
                    className="h-[30px] text-[13px]"
                    onClick={() => setIntent({ toStage: openFirstStage.id })}
                  >
                    <Undo2 className="w-[14px] h-[14px]" />
                    {t("Reopen")}
                  </Btn>
                )}
              </div>
            )}

            {intent ? (
              <OutcomeForm
                key={intent.outcome?.id ?? intent.toStage}
                flow={flow}
                lead={lead}
                intent={intent}
                queueMode={queueMode}
                saving={saving}
                error={error}
                onCancel={() => setIntent(null)}
                onSwitch={setIntent}
                onSave={async (submit) => {
                  if (await onSubmit(lead, submit)) setIntent(null);
                }}
              />
            ) : (
              isOpenPhase(p.phase) && (
                <div>
                  <Label>{t("What happened?")}</Label>
                  <OutcomeGrid flow={flow} onPick={setIntent} />
                </div>
              )
            )}

            <History lead={lead} />
          </div>

          <div className="p-[20px] bg-sidebar border-t @[780px]:border-t-0 @[780px]:border-s border-border">
            {(p.attempts > 0 || customFields.length > 0) && (
              <div className="label mb-[4px]">{t("Lead details")}</div>
            )}
            <DetailRow
              label={t("Attempts")}
              value={
                p.attempts
                  ? `${p.attempts} ${t("of")} ${flow.max_attempts}`
                  : null
              }
            />
            {customFields.map((f) => (
              <DetailRow
                key={f.id}
                label={f.label}
                value={
                  f.type === "money"
                    ? `₪${p.fields[f.id]}`
                    : String(p.fields[f.id])
                }
                strong={f.type === "money"}
              />
            ))}

            {answers.length > 0 && (
              <>
                <div className="label mb-[4px] mt-[22px]">
                  {t("Form answers")}
                </div>
                {answers.map(([question, answer]) => (
                  <DetailRow
                    key={question}
                    label={question.replaceAll("_", " ")}
                    value={answer}
                  />
                ))}
              </>
            )}

            <div className="label mb-[4px] mt-[22px]">
              {t("Where it came from")}
            </div>
            <DetailRow
              label={t("Source")}
              value={
                lead.contact?.source
                  ? t(SOURCE_LABELS[lead.contact.source] ?? lead.contact.source)
                  : null
              }
            />
            <DetailRow label={t("Form")} value={lead.form_name} />
            <DetailRow
              label={t("Campaign")}
              value={lead.campaign_id && ltrIsolate(lead.campaign_id)}
            />
            <DetailRow
              label={t("Ad")}
              value={lead.ad_id && ltrIsolate(lead.ad_id)}
            />
            <DetailRow label={t("Created")} value={ago(lead.created_time)} />
            <DetailRow
              label={t("Submitted again")}
              value={
                merged?.length
                  ? merged.map((m) => ago(m.created_time)).join(", ")
                  : null
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}
