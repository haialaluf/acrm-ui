import { useEffect, useMemo, useState } from "react";
import { useBlocker, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, BarChart3, Copy, Info, Trash2 } from "lucide-react";
import { Switch } from "antd";
import type { AutomationStep, AutomationTrigger } from "@/supabase/client";
import ConfirmModal from "@/components/ConfirmModal";
import { useTranslation } from "@/hooks/useTranslation";
import { useIsMobile } from "@/hooks/useIsMobile";
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
import BottomSheet from "./BottomSheet";
import { blankStep, type StepType } from "./catalog";
import { duplicateStep, findStep, mapStep, removeStep, updateAt } from "./tree";
import { flowSentence, type Lookups, stepInfo, triggerInfo } from "./summaries";

/**
 * The flow editor: canvas on the left, configuration drawer on the right. On a
 * phone the canvas takes the whole screen and the drawer is a bottom sheet
 * that opens when a card is tapped.
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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sentenceOpen, setSentenceOpen] = useState(false);
  const isMobile = useIsMobile();
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

  // Leaving with unsaved edits - the back button, a sidebar link, a browser
  // back/refresh - silently discards them, since the definition only lives in
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

  const openNode = (nodeId: Selection) => {
    setSelected(nodeId);
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setSelected("trigger");
    setDrawerOpen(false);
  };

  const duplicate = (step: AutomationStep) => {
    const copy = duplicateStep(step);
    // Appended to the trunk rather than inserted beside the original: the
    // caller knows the step, not the list it lives in, and a copy landing
    // inside a branch it was never in is more surprising than one landing at
    // the end.
    editSteps((list) => [...list, copy]);
    setSelected(copy.id);
  };

  const remove = (step: AutomationStep) => {
    editSteps((list) => removeStep(list, step.id));
    if (selected === step.id) closeDrawer();
  };

  const ctx: FlowContextValue = {
    // A phone shows the selection only while its sheet is open; otherwise the
    // trigger would look selected on every visit.
    selectedId: isMobile && !drawerOpen ? null : selected,
    showStats,
    stats: stepStats,
    triggerStat: stats?.get(id)?.entered,
    lookups,
    select: openNode,
    insert: (path, index, anchor) => setInsertAt({ path, index, anchor }),
    stepMenu: (step, anchor) => setStepMenuAt({ step, anchor }),
  };

  const info = selectedStep
    ? stepInfo(selectedStep, lookups, t)
    : triggerInfo(trigger, lookups, t);
  const InfoIcon = info.icon;

  const drawerHeader = (
    <div className="flex items-start gap-[11px]">
      <span
        className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg text-white"
        style={{ background: info.tint }}
      >
        <InfoIcon className="h-[17px] w-[17px]" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-semibold text-card-foreground max-md:text-[15px]">
          {selectedStep ? info.title : t("Trigger")}
        </div>
        <div className="mt-[3px] truncate text-[12.5px] text-muted-foreground max-md:text-[13px]">
          {selectedStep ? t("Step settings") : info.title}
        </div>
      </div>
    </div>
  );

  const drawerBody = selectedStep ? (
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
  );

  const finishButton = (
    <button
      type="button"
      disabled={updateAutomation.isPending}
      className={
        "rounded-lg border px-[10px] py-[5px] text-[12.5px] disabled:opacity-45 max-md:px-5 max-md:py-[10px] max-md:text-[15px] max-md:font-medium " +
        (dirty
          ? "max-md:border-primary max-md:bg-primary max-md:text-white md:border-border md:bg-card md:hover:bg-muted"
          : "border-border bg-card hover:bg-muted")
      }
      onClick={async () => {
        if (dirty) await save();
        closeDrawer();
      }}
    >
      {dirty ? t("Save") : t("Done")}
    </button>
  );

  const drawerFooter = selectedStep ? (
    <div className="flex items-center gap-2">
      <button
        type="button"
        className="inline-flex items-center gap-[7px] rounded-lg border border-border bg-card px-[10px] py-[5px] text-[12.5px] text-destructive hover:bg-destructive/10 max-md:py-[10px] max-md:text-[14px]"
        onClick={() => remove(selectedStep)}
      >
        <Trash2 className="h-[14px] w-[14px] max-md:h-4 max-md:w-4" />
        {t("Delete step")}
      </button>
      <button
        type="button"
        aria-label={t("Duplicate")}
        title={t("Duplicate")}
        className="inline-flex items-center rounded-lg border border-border bg-card px-[8px] py-[5px] text-muted-foreground hover:bg-muted max-md:px-3 max-md:py-[10px]"
        onClick={() => duplicate(selectedStep)}
      >
        <Copy className="h-[14px] w-[14px] max-md:h-4 max-md:w-4" />
      </button>
      <div className="flex-1" />
      {finishButton}
    </div>
  ) : (
    <div className="flex justify-end">{finishButton}</div>
  );

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card ps-3 pe-4 max-md:gap-2 max-md:pe-3">
          <button
            type="button"
            aria-label={t("Back to automations")}
            className="rounded-lg border border-border bg-card p-[6px] hover:bg-muted max-md:border-0 max-md:p-2"
            onClick={() => navigate({ to: "/automations" })}
          >
            <ArrowLeft className="h-[17px] w-[17px] max-md:h-5 max-md:w-5" />
          </button>

          <input
            className="min-w-0 flex-[0_1_280px] rounded-[7px] border border-transparent bg-transparent px-[7px] py-1 text-[15px] font-semibold text-card-foreground outline-none hover:border-border focus:border-primary focus:bg-background max-md:flex-1 max-md:text-base md:min-w-[90px]"
            value={name}
            aria-label={t("Automation name")}
            onChange={(e) => {
              setName(e.target.value);
              setDirty(true);
            }}
          />

          <span className="inline-flex items-center gap-[5px] rounded-md bg-secondary px-[7px] py-[2px] text-xs text-secondary-foreground max-md:hidden">
            <span className={"h-[7px] w-[7px] rounded-full " + status.dot} />
            {t(status.label)}
          </span>

          <div className="flex-1 max-md:hidden" />

          <button
            type="button"
            aria-label={t("Stats")}
            aria-pressed={showStats}
            className={
              "inline-flex shrink-0 items-center gap-[7px] rounded-lg border px-[10px] py-[5px] text-[12.5px] max-md:p-2 " +
              (showStats
                ? "border-primary bg-primary text-white"
                : "border-border bg-card hover:bg-muted")
            }
            onClick={() => setShowStats(!showStats)}
          >
            <BarChart3 className="h-[14px] w-[14px] max-md:h-4 max-md:w-4" />
            <span className="max-md:hidden">{t("Stats")}</span>
          </button>

          <Switch
            className="shrink-0"
            size={isMobile ? "default" : "small"}
            checked={automation.status === "live"}
            aria-label={t(status.label)}
            onChange={(checked) =>
              void save({ status: checked ? "live" : "paused" })
            }
          />

          <button
            type="button"
            disabled={!dirty || updateAutomation.isPending}
            className="shrink-0 rounded-lg border border-primary bg-primary px-[13px] py-[5px] text-[12.5px] text-white disabled:opacity-45 max-md:px-3 max-md:py-2 max-md:text-[14px]"
            onClick={() => void save()}
          >
            {dirty ? t("Save") : t("Saved")}
          </button>
        </div>

        <button
          type="button"
          className="flex w-full items-start gap-2 border-b border-border bg-card px-[22px] py-[9px] text-start text-[12.5px] leading-relaxed text-muted-foreground max-md:px-4 md:cursor-default"
          aria-expanded={isMobile ? sentenceOpen : undefined}
          onClick={() => setSentenceOpen(!sentenceOpen)}
        >
          <Info className="mt-[3px] h-[14px] w-[14px] shrink-0" />
          <span
            className={"min-w-0 " + (sentenceOpen ? "" : "max-md:line-clamp-2")}
          >
            <b className="font-semibold text-foreground">{sentence.head}</b>
            {sentence.parts.length ? " → " : ""}
            {sentence.parts.join(" → ")}.
          </span>
        </button>

        <FlowCanvas trigger={trigger} steps={steps} ctx={ctx} />
      </div>

      {isMobile ? (
        drawerOpen && (
          <BottomSheet
            title={selectedStep ? info.title : t("Trigger")}
            header={drawerHeader}
            footer={drawerFooter}
            onClose={() => setDrawerOpen(false)}
          >
            <div className="p-[18px]">{drawerBody}</div>
          </BottomSheet>
        )
      ) : (
        <aside className="flex w-[372px] shrink-0 flex-col overflow-hidden border-s border-border bg-card">
          <div className="border-b border-border px-[18px] pb-[14px] pt-4">
            {drawerHeader}
          </div>

          <div className="min-h-0 flex-1 overflow-auto p-[18px]">
            {drawerBody}
          </div>

          {selectedStep && (
            <div className="border-t border-border px-[18px] py-3">
              {drawerFooter}
            </div>
          )}
        </aside>
      )}

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
            setInsertAt(null);
            openNode(step.id);
          }}
        />
      )}

      {stepMenuAt && (
        <StepMenu
          anchor={stepMenuAt.anchor}
          onClose={() => setStepMenuAt(null)}
          onDuplicate={() => {
            duplicate(stepMenuAt.step);
            setStepMenuAt(null);
          }}
          onDelete={() => {
            remove(stepMenuAt.step);
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
