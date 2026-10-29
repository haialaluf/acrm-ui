import { useState } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import type { PipelineLead } from "@/queries/useLeads";
import type { LeadFlow, LeadStage } from "@/supabase/client";
import { isOpenPhase, stageToneStyle } from "@/utils/leads";
import { AttemptDots, maxAttemptsOf, NextLine } from "./LeadBits";
import {
  LeadAvatar,
  leadName,
  ListHeader,
  useQueueCount,
  type LeadsView,
} from "./LeadList";

const DRAG_TYPE = "application/x-lead";

export default function LeadBoard({
  flow,
  leads,
  onView,
  onOpen,
  onDropMove,
  canSetup,
}: {
  flow: LeadFlow;
  leads: PipelineLead[];
  onView: (view: LeadsView) => void;
  onOpen: (id: string) => void;
  onDropMove: (id: string, stageId: string) => void;
  canSetup: boolean;
}) {
  const { translate: t } = useTranslation();
  const [over, setOver] = useState<string | null>(null);
  const queueCount = useQueueCount(leads);
  const columns = flow.stages.filter((s) => isOpenPhase(s.phase));
  const ends = flow.stages.filter((s) => !isOpenPhase(s.phase));
  const inStage = (stage: LeadStage) =>
    leads.filter((l) => l.pipeline.stage === stage.id);

  const dropTarget = (stageId: string) => ({
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      setOver(stageId);
    },
    onDragLeave: () => setOver(null),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setOver(null);
      const id = e.dataTransfer.getData(DRAG_TYPE);
      if (id) onDropMove(id, stageId);
    },
  });

  return (
    <div className="h-full flex flex-col bg-sidebar">
      <div className="max-w-[520px]">
        <ListHeader
          view="board"
          onView={onView}
          queueCount={queueCount}
          canSetup={canSetup}
        />
      </div>
      <div className="grow flex gap-[12px] px-[16px] pb-[16px] overflow-x-auto snap-x snap-mandatory md:snap-none">
        {columns.map((stage) => {
          const items = inStage(stage);
          return (
            <div
              key={stage.id}
              {...dropTarget(stage.id)}
              style={stageToneStyle(stage)}
              className={`stage-tone flex flex-col rounded-2xl shrink-0 w-[82vw] max-w-[300px] md:w-[272px] snap-start transition-colors ${
                over === stage.id ? "bg-[var(--stage-bg)]" : "bg-muted"
              }`}
            >
              <div className="flex items-center gap-[8px] px-[14px] pt-[12px] pb-[8px]">
                <span className="w-[8px] h-[8px] rounded-full bg-[var(--stage-dot)]" />
                <span className="text-[14px] font-semibold">{stage.name}</span>
                <span className="text-[12px] text-muted-foreground">
                  {items.length}
                </span>
              </div>
              <div className="grow overflow-y-auto px-[8px] pb-[8px] flex flex-col gap-[6px]">
                {items.map((lead) => (
                  <div
                    key={lead.leadgen_id}
                    draggable
                    onDragStart={(e) =>
                      e.dataTransfer.setData(DRAG_TYPE, lead.leadgen_id)
                    }
                    onClick={() => onOpen(lead.leadgen_id)}
                    className="rounded-xl p-[10px] cursor-pointer bg-background border border-border hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center gap-[8px]">
                      <LeadAvatar lead={lead} size={26} />
                      <span className="text-[14px] truncate grow">
                        {leadName(lead)}
                      </span>
                      <AttemptDots
                        n={lead.pipeline.attempts}
                        max={maxAttemptsOf(flow)}
                      />
                    </div>
                    <div className="text-[12px] mt-[6px] truncate text-muted-foreground">
                      <NextLine
                        pipeline={lead.pipeline}
                        createdTime={lead.created_time}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        <div className="flex flex-col gap-[12px] shrink-0 w-[82vw] max-w-[300px] md:w-[200px] snap-start">
          {ends.map((stage) => {
            const items = inStage(stage);
            return (
              <div
                key={stage.id}
                {...dropTarget(stage.id)}
                style={stageToneStyle(stage)}
                className={`stage-tone flex-1 rounded-2xl p-[14px] flex flex-col gap-[6px] border-2 border-dashed ${
                  over === stage.id
                    ? "border-[var(--stage-dot)] bg-[var(--stage-bg)]"
                    : "border-border"
                }`}
              >
                <div className="flex items-center gap-[8px]">
                  <span className="w-[8px] h-[8px] rounded-full bg-[var(--stage-dot)]" />
                  <span className="text-[14px] font-semibold">
                    {stage.name}
                  </span>
                  <span className="text-[12px] text-muted-foreground">
                    {items.length}
                  </span>
                </div>
                <div className="text-[12px] text-muted-foreground">
                  {t("Drag here to close")}
                </div>
                {items.slice(0, 4).map((lead) => (
                  <button
                    key={lead.leadgen_id}
                    type="button"
                    onClick={() => onOpen(lead.leadgen_id)}
                    className="text-start text-[13px] truncate hover:underline"
                  >
                    {leadName(lead)}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
