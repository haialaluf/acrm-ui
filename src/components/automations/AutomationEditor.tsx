import { useEffect, useMemo, useState } from "react";
import { useBlocker, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, BarChart3, Info, Trash2 } from "lucide-react";
import { Switch } from "antd";
import type { AutomationStep, AutomationTrigger } from "@/supabase/client";
import ConfirmModal from "@/components/ConfirmModal";
import { useTranslation } from "@/hooks/useTranslation";
import { useCurrentAgents } from "@/queries/useAgents";
import { useCalendars } from "@/queries/useCalendars";
import { useEmailTemplates } from "@/queries/useEmailTemplates";
import {
  useApprovedTemplates,
  useAutomation,
  useAutomationStats,
  useAutomationStepStats,
  useUpdateAutomation,
} from "@/queries/useAutomations";
import FlowCanvas from "./flow/FlowCanvas";
import type { FlowContextValue } from "./flow/context";
import TriggerPanel from "./TriggerPanel";
import StepPanel from "./StepPanel";
import { InsertMenu, StepMenu } from "./InsertMenu";
import { blankStep, type StepType } from "./catalog";
import { duplicateStep, findStep, mapStep, removeStep, updateAt } from "./tree";
import { flowSentence, type Lookups, stepInfo, triggerInfo } from "./summaries";

/**
 * The flow editor: canvas on the left, configuration drawer on the right.
 *
 * The whole definition is one piece of local state, edited immutably and saved
 * explicitly. Autosave was tempting and is wrong here: a live automation is
 * enrolling contacts while you edit it, and half-finished steps must not
 * become the definition new runs snapshot.
 */

/** A step id, or the literal `"trigger"` for the trigger node. */
type Selection = string;

export default function AutomationEditor({ id }: { id: string }) {
  const { translate: t } = useTranslation();
  const navigate = useNavigate();

  const { data: automation, isLoading } = useAutomation(id);
  const updateAutomation = useUpdateAutomation();

  const { data: agents } = useCurrentAgents();
  const { data: templates } = useApprovedTemplates();
  const { data: emailTemplates } = useEmailTemplates();
  const { data: calendars } = useCalendars();
  const { data: stats } = useAutomationStats();

  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState<AutomationTrigger | null>(null);
  const [steps, setSteps] = useState<AutomationStep[]>([]);
  const [dirty, setDirty] = useState(false);

  const [selected, setSelected] = useState<Selection>("trigger");
  const [showStats, setShowStats] = useState(false);
  const [insertAt, setInsertAt] = useState<{
    path: string[];
    index: number;
    anchor: DOMRect;
  } | null>(null);
  const [stepMenuAt, setStepMenuAt] = useState<{
    step: AutomationStep;
    anchor: DOMRect;
  } | null>(null);

  const { data: stepStats } = useAutomationStepStats(id, showStats);

  // Leaving with unsaved edits — the back button, a sidebar link, a browser
  // back/refresh — silently discards them, since the definition only lives in
  // local state until "Save" is pressed. Block navigation and ask first.
  const leaveBlocker = useBlocker({
    shouldBlockFn: () => dirty,
    enableBeforeUnload: dirty,
    withResolver: true,
  });

  // Load the saved definition into local state once, and again whenever the
  // server copy changes underneath an unedited editor.
  useEffect(() => {
    if (!automation || dirty) return;
    setName(automation.name);
    setTrigger(automation.trigger);
    setSteps(automation.steps);
  }, [automation, dirty]);

  const lookups: Lookups = useMemo(
    () => ({
      agents: (agents ?? []).map((a) => ({ id: a.id, name: a.name, ai: a.ai })),
      templates: (templates ?? []).map((x) => ({ id: x.id, name: x.name })),
      emailTemplates: (emailTemplates ?? []).map((x) => ({
        id: x.id,
        name: x.name,
      })),
      calendars: (calendars ?? []).map((c) => ({ id: c.id, name: c.name })),
    }),
    [agents, templates, emailTemplates, calendars],
  );

  if (isLoading || !automation || !trigger) return null;

  const selectedStep =
    selected === "trigger" ? null : findStep(steps, selected);

  const editSteps = (fn: (list: AutomationStep[]) => AutomationStep[]) => {
    setSteps(fn(steps));
    setDirty(true);
  };

  const save = async (patch?: { status?: "live" | "paused" }) => {
    await updateAutomation.mutateAsync({
      id,
      version: automation.version,
      definitionChanged: dirty,
      name,
      trigger,
      steps,
      ...patch,
    });
    setDirty(false);
  };

  const sentence = flowSentence(trigger, steps, lookups, t);
  const status = patchStatus(automation.status);

  const ctx: FlowContextValue = {
    selectedId: selected === "trigger" ? "trigger" : selected,
    showStats,
    stats: stepStats,
    triggerStat: stats?.get(id)?.entered,
    lookups,
    select: setSelected,
    insert: (path, index, anchor) => setInsertAt({ path, index, anchor }),
    stepMenu: (step, anchor) => setStepMenuAt({ step, anchor }),
  };

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        {/* toolbar */}
        <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card ps-3 pe-4">
          <button
            type="button"
            aria-label={t("Back to automations")}
            className="rounded-lg border border-border bg-card p-[6px] hover:bg-muted"
            onClick={() => navigate({ to: "/automations" })}
          >
            <ArrowLeft className="h-[17px] w-[17px]" />
          </button>

          <input
            className="min-w-[90px] flex-[0_1_280px] rounded-[7px] border border-transparent bg-transparent px-[7px] py-1 text-[15px] font-semibold text-card-foreground outline-none hover:border-border focus:border-primary focus:bg-background"
            value={name}
            aria-label={t("Automation name")}
            onChange={(e) => {
              setName(e.target.value);
              setDirty(true);
            }}
          />

          <span className="inline-flex items-center gap-[5px] rounded-md bg-secondary px-[7px] py-[2px] text-xs text-secondary-foreground">
            <span className={"h-[7px] w-[7px] rounded-full " + status.dot} />
            {t(status.label)}
          </span>

          <div className="flex-1" />

          <button
            type="button"
            className={
              "inline-flex items-center gap-[7px] rounded-lg border px-[10px] py-[5px] text-[12.5px] " +
              (showStats
                ? "border-primary bg-primary text-white"
                : "border-border bg-card hover:bg-muted")
            }
            onClick={() => setShowStats(!showStats)}
          >
            <BarChart3 className="h-[14px] w-[14px]" />
            {t("Stats")}
          </button>

          <Switch
            size="small"
            checked={automation.status === "live"}
            onChange={(checked) =>
              void save({ status: checked ? "live" : "paused" })
            }
          />

          <button
            type="button"
            disabled={!dirty || updateAutomation.isPending}
            className="rounded-lg border border-primary bg-primary px-[13px] py-[5px] text-[12.5px] text-white disabled:opacity-45"
            onClick={() => void save()}
          >
            {dirty ? t("Save") : t("Saved")}
          </button>
        </div>

        {/* the flow in one sentence */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-[22px] py-[9px] text-[12.5px] leading-relaxed text-muted-foreground">
          <Info className="h-[14px] w-[14px] shrink-0" />
          <span>
            <b className="font-semibold text-foreground">{sentence.head}</b>
            {sentence.parts.length ? " → " : ""}
            {sentence.parts.join(" → ")}.
          </span>
        </div>

        {/* canvas */}
        <FlowCanvas trigger={trigger} steps={steps} ctx={ctx} />
      </div>

      {/* configuration drawer */}
      <aside className="flex w-[372px] shrink-0 flex-col overflow-hidden border-s border-border bg-card">
        <div className="flex items-start gap-[11px] border-b border-border px-[18px] pb-[14px] pt-4">
          {(() => {
            const info = selectedStep
              ? stepInfo(selectedStep, lookups, t)
              : triggerInfo(trigger, lookups, t);
            const Icon = info.icon;

            return (
              <>
                <span
                  className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg text-white"
                  style={{ background: info.tint }}
                >
                  <Icon className="h-[17px] w-[17px]" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-semibold text-card-foreground">
                    {selectedStep ? info.title : t("Trigger")}
                  </div>
                  <div className="mt-[3px] text-[12.5px] text-muted-foreground">
                    {selectedStep ? t("Step settings") : info.title}
                  </div>
                </div>
              </>
            );
          })()}
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-[18px]">
          {selectedStep ? (
            <StepPanel
              key={selectedStep.id}
              step={selectedStep}
              onChange={(next) =>
                editSteps((list) => mapStep(list, selectedStep.id, () => next))
              }
            />
          ) : (
            <TriggerPanel
              trigger={trigger}
              onChange={(next) => {
                setTrigger(next);
                setDirty(true);
              }}
            />
          )}
        </div>

        {selectedStep && (
          <div className="flex justify-between gap-2 border-t border-border px-[18px] py-3">
            <button
              type="button"
              className="inline-flex items-center gap-[7px] rounded-lg border border-border bg-card px-[10px] py-[5px] text-[12.5px] text-destructive hover:bg-destructive/10"
              onClick={() => {
                editSteps((list) => removeStep(list, selectedStep.id));
                setSelected("trigger");
              }}
            >
              <Trash2 className="h-[14px] w-[14px]" />
              {t("Delete step")}
            </button>
            <button
              type="button"
              disabled={updateAutomation.isPending}
              className="rounded-lg border border-border bg-card px-[10px] py-[5px] text-[12.5px] hover:bg-muted disabled:opacity-45"
              onClick={async () => {
                if (dirty) await save();
                setSelected("trigger");
              }}
            >
              {dirty ? t("Save") : t("Done")}
            </button>
          </div>
        )}
      </aside>

      {insertAt && (
        <InsertMenu
          anchor={insertAt.anchor}
          onClose={() => setInsertAt(null)}
          onPick={(type: StepType) => {
            const step = blankStep(type);
            editSteps((list) =>
              updateAt(list, insertAt.path, (branchSteps) => [
                ...branchSteps.slice(0, insertAt.index),
                step,
                ...branchSteps.slice(insertAt.index),
              ]),
            );
            setSelected(step.id);
            setInsertAt(null);
          }}
        />
      )}

      {stepMenuAt && (
        <StepMenu
          anchor={stepMenuAt.anchor}
          onClose={() => setStepMenuAt(null)}
          onDuplicate={() => {
            const copy = duplicateStep(stepMenuAt.step);
            // Appended to the trunk rather than inserted beside the original:
            // the menu knows the step, not the list it lives in, and a copy
            // landing inside a branch it was never in is more surprising than
            // one landing at the end.
            editSteps((list) => [...list, copy]);
            setStepMenuAt(null);
            setSelected(copy.id);
          }}
          onDelete={() => {
            editSteps((list) => removeStep(list, stepMenuAt.step.id));
            if (selected === stepMenuAt.step.id) setSelected("trigger");
            setStepMenuAt(null);
          }}
        />
      )}

      <ConfirmModal
        open={leaveBlocker.status === "blocked"}
        title={t("Discard unsaved changes?")}
        body={t(
          "This automation has unsaved changes. Leaving now will discard them.",
        )}
        confirmLabel={t("Discard changes")}
        onConfirm={() => leaveBlocker.proceed?.()}
        onCancel={() => leaveBlocker.reset?.()}
      />
    </div>
  );
}

function patchStatus(status: string): { dot: string; label: string } {
  if (status === "live") return { dot: "bg-success", label: "Live" };
  if (status === "paused") return { dot: "bg-warning", label: "Paused" };
  return { dot: "bg-input", label: "Draft" };
}
