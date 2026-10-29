import { useContext, useEffect, useState } from "react";
import { Navigate } from "@tanstack/react-router";
import { Check, LoaderCircle, Workflow } from "lucide-react";
import { TickContext } from "@/contexts/useTick";
import { useTranslation } from "@/hooks/useTranslation";
import { useCurrentAgent } from "@/queries/useAgents";
import {
  useApplyLeadOutcome,
  useLeadFlow,
  useLeads,
  useRestoreLead,
  useSnoozeLead,
  type ApplyOutcomeResult,
  type PipelineLead,
} from "@/queries/useLeads";
import type { LeadChange, LeadNext } from "@/supabase/client";
import { isAdminRole } from "@/utils/roles";
import { NEXT_TYPE_LABELS, queueGroups, stageOf } from "@/utils/leads";
import { useFormatWhen } from "./LeadBits";
import LeadBoard from "./LeadBoard";
import LeadList, { type LeadsView } from "./LeadList";
import LeadPanel from "./LeadPanel";
import type { OutcomeIntent, OutcomeSubmit } from "./OutcomeForm";

type Toast = {
  message: string;
  undo?: {
    leadId: string;
    contactId: string | null;
    change: LeadChange;
    noteId?: string | null;
  };
};

const TOAST_MS = 5000;

const flatQueue = (
  leads: PipelineLead[],
  now: Parameters<typeof queueGroups>[1],
) => queueGroups(leads, now).flatMap((g) => g.leads.map((l) => l.leadgen_id));

export default function LeadsPage({
  view,
  leadId,
  onNavigate,
}: {
  view: LeadsView;
  leadId: string | null;
  onNavigate: (search: { view?: LeadsView; lead?: string | null }) => void;
}) {
  const { translate: t } = useTranslation();
  const now = useContext(TickContext);
  const formatWhen = useFormatWhen();
  const { data: me } = useCurrentAgent();
  const canSetup = isAdminRole(me?.extra?.role);
  const { data: flow, isPending: flowPending } = useLeadFlow();
  const { data: leads = [], isPending: leadsPending } = useLeads();
  const applyOutcome = useApplyLeadOutcome();
  const snooze = useSnoozeLead();
  const restore = useRestoreLead();
  const [toast, setToast] = useState<Toast | null>(null);
  const [drawer, setDrawer] = useState<{
    id: string;
    intent?: OutcomeIntent;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  if (flowPending || leadsPending) {
    return (
      <div className="h-full flex items-center justify-center">
        <LoaderCircle className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!flow) {
    if (canSetup) return <Navigate to="/leads/setup" replace />;
    return (
      <div className="h-full flex flex-col items-center justify-center gap-[10px] text-center px-[30px]">
        <Workflow className="w-[28px] h-[28px] text-muted-foreground" />
        <div className="text-[16px]">{t("Leads are not set up yet")}</div>
        <div className="text-[13px] text-muted-foreground max-w-[360px]">
          {t(
            "An admin of your organization needs to define the lead flow first.",
          )}
        </div>
      </div>
    );
  }

  const selectedId = view === "board" ? (drawer?.id ?? null) : leadId;
  const selected = leads.find((l) => l.leadgen_id === selectedId);

  async function submit(lead: PipelineLead, s: OutcomeSubmit) {
    setError(null);
    const orderBefore = flatQueue(leads, now);
    let result: ApplyOutcomeResult;
    try {
      result = await applyOutcome.mutateAsync({
        leadId: lead.leadgen_id,
        contactId: lead.contact_id,
        outcomeId: s.outcomeId,
        toStage: s.toStage,
        fields: s.fields,
        next: s.next,
        note: s.note || undefined,
        sendTemplate: s.sendTemplate,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    }

    const parts = [t("Saved")];
    if (result.pipeline.next) {
      parts.push(
        `${t("Next step")}: ${t(NEXT_TYPE_LABELS[result.pipeline.next.type])} ${formatWhen(result.pipeline.next.at)}`,
      );
    } else if (result.pipeline.stage !== result.previous.stage) {
      parts.push(
        `${t("Moved to")} ${stageOf(flow, result.pipeline.stage)?.name ?? ""}`,
      );
    }
    if (result.template?.sent) parts.push(t("WhatsApp message sent"));
    if (result.template && !result.template.sent) {
      parts.push(`${t("Message not sent")}: ${result.template.reason}`);
    }

    if (view === "queue") {
      const index = orderBefore.indexOf(lead.leadgen_id);
      const nextId = orderBefore
        .slice(index + 1)
        .find((id) => id !== lead.leadgen_id);
      if (nextId) {
        onNavigate({ lead: nextId });
        parts.push(t("On to the next lead"));
      }
    }

    setDrawer(null);
    setToast({
      message: parts.join(" · "),
      undo: {
        leadId: lead.leadgen_id,
        contactId: lead.contact_id,
        change: result,
        noteId: result.note_id,
      },
    });
    return true;
  }

  function doSnooze(lead: PipelineLead, next: LeadNext) {
    snooze.mutate(
      { leadId: lead.leadgen_id, next },
      {
        onSuccess: (change) =>
          setToast({
            message: `${t("Next step moved to")} ${formatWhen(next.at)}`,
            undo: {
              leadId: lead.leadgen_id,
              contactId: lead.contact_id,
              change,
            },
          }),
        onError: (e) => setToast({ message: e.message }),
      },
    );
  }

  function undo(u: NonNullable<Toast["undo"]>) {
    setToast(null);
    restore.mutate(u, {
      onSuccess: () => {
        if (view !== "board") onNavigate({ lead: u.leadId });
      },
      onError: (e) =>
        setToast({
          message: e.message.includes("lead_changed")
            ? t("Could not undo - the lead changed since")
            : e.message,
        }),
    });
  }

  const panelProps = {
    flow,
    lead: selected,
    saving: applyOutcome.isPending,
    error,
    onSubmit: submit,
    onSnooze: doSnooze,
  };

  return (
    <div className="h-full relative">
      {view === "board" ? (
        <>
          <LeadBoard
            flow={flow}
            leads={leads}
            onView={(v) => onNavigate({ view: v, lead: null })}
            onOpen={(id) => {
              setError(null);
              setDrawer({ id });
            }}
            onDropMove={(id, stageId) => {
              const lead = leads.find((l) => l.leadgen_id === id);
              if (lead && lead.pipeline.stage !== stageId) {
                setError(null);
                setDrawer({ id, intent: { toStage: stageId } });
              }
            }}
            canSetup={canSetup}
          />
          {selected && (
            <>
              <div
                className="absolute inset-0 bg-black/20"
                onClick={() => setDrawer(null)}
              />
              <div className="absolute inset-y-0 end-0 w-[min(720px,100%)] shadow-2xl">
                <LeadPanel
                  {...panelProps}
                  queueMode={false}
                  initialIntent={drawer?.intent}
                  onClose={() => setDrawer(null)}
                />
              </div>
            </>
          )}
        </>
      ) : (
        <div className="h-full flex">
          <div
            className={`h-full shrink-0 w-full md:w-[400px] md:border-e border-border ${
              selected ? "hidden md:block" : "block"
            }`}
          >
            <LeadList
              flow={flow}
              leads={leads}
              view={view}
              onView={(v) => onNavigate({ view: v })}
              selectedId={selectedId}
              onOpen={(id) => {
                setError(null);
                onNavigate({ lead: id });
              }}
              canSetup={canSetup}
            />
          </div>
          <div
            className={`grow min-w-0 h-full ${selected ? "block" : "hidden md:block"}`}
          >
            <LeadPanel
              {...panelProps}
              queueMode={view === "queue"}
              onBack={selected ? () => onNavigate({ lead: null }) : undefined}
            />
          </div>
        </div>
      )}

      {toast && (
        <div className="absolute bottom-[22px] start-1/2 -translate-x-1/2 rtl:translate-x-1/2 z-50 flex items-center gap-[12px] rounded-2xl ps-[16px] pe-[8px] py-[7px] min-h-[44px] w-max max-w-[calc(100%-24px)] bg-foreground text-background text-[14px] shadow-xl">
          <Check className="w-[16px] h-[16px] text-success shrink-0" />
          <span>{toast.message}</span>
          {toast.undo && (
            <button
              type="button"
              onClick={() => undo(toast.undo!)}
              className="rounded-full shrink-0 h-[30px] px-[12px] bg-background/15 hover:bg-background/25"
            >
              {t("Undo")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
