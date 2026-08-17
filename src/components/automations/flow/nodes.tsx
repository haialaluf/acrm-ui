import { Handle, type NodeProps, Position } from "@xyflow/react";
import { MoreHorizontal } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { type NodeInfo, stepInfo, triggerInfo } from "../summaries";
import { useFlowContext } from "./context";
import type { CapNodeType, StepNodeType, TriggerNodeType } from "./layout";

/**
 * The four things the canvas draws.
 *
 * Selection is ours, not React Flow's: nodes are neither draggable nor
 * selectable, so the pane is free to pan from anywhere and the selected ring is
 * driven by the same id the drawer on the right is editing.
 */

const HANDLE_CLASS = "!h-px !w-px !min-h-0 !min-w-0 !border-0 !bg-transparent";

function Ports({ source = true, target = true }) {
  return (
    <>
      {target && (
        <Handle
          type="target"
          position={Position.Top}
          isConnectable={false}
          className={HANDLE_CLASS}
        />
      )}
      {source && (
        <Handle
          type="source"
          position={Position.Bottom}
          isConnectable={false}
          className={HANDLE_CLASS}
        />
      )}
    </>
  );
}

function NodeCard({
  info,
  id,
  stat,
  onMenu,
}: {
  info: NodeInfo;
  id: string;
  stat?: number;
  onMenu?: (anchor: DOMRect) => void;
}) {
  const { translate: t } = useTranslation();
  const ctx = useFlowContext();
  const Icon = info.icon;
  const selected = ctx.selectedId === id;

  return (
    <div
      role="button"
      tabIndex={0}
      // Clicks arrive through React Flow's `onNodeClick`; this covers the
      // keyboard, which never reaches the pane.
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          ctx.select(id);
        }
      }}
      className={
        "group relative flex w-full cursor-pointer items-start gap-[11px] rounded-xl border bg-card p-3 text-start shadow-sm transition-colors " +
        (selected
          ? "border-primary ring-3 ring-primary/15"
          : "border-border hover:border-input")
      }
    >
      <span
        className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg text-white"
        style={{ background: info.tint }}
      >
        <Icon className="h-[17px] w-[17px]" />
      </span>

      <div className="min-w-0 flex-1">
        {info.eyebrow && (
          <div className="mb-[5px] text-[10.5px] font-bold uppercase tracking-[0.07em] text-muted-foreground">
            {info.eyebrow}
          </div>
        )}
        <div className="text-[13.5px] font-semibold leading-tight text-card-foreground">
          {info.title}
        </div>
        {info.sub && (
          <div className="mt-[3px] break-words text-[12.5px] leading-snug text-muted-foreground">
            {info.sub}
          </div>
        )}
        {info.prompt && (
          <div className="mt-[6px] rounded-md bg-muted px-[9px] py-[7px] text-[12.5px] italic leading-snug text-muted-foreground">
            “
            {info.prompt.length > 96
              ? info.prompt.slice(0, 96) + "…"
              : info.prompt}
            ”
          </div>
        )}
        {ctx.showStats && stat != null && (
          <div className="mt-2 border-t border-border pt-2 text-[11.5px] tabular-nums text-muted-foreground">
            <b className="font-semibold text-foreground">
              {stat.toLocaleString()}
            </b>{" "}
            {t("entered")}
          </div>
        )}
      </div>

      {onMenu && (
        <button
          type="button"
          aria-label={t("Step options")}
          className={
            "absolute end-2 top-2 rounded-md p-1 text-muted-foreground transition-opacity hover:bg-muted " +
            (selected ? "opacity-100" : "opacity-0 group-hover:opacity-100")
          }
          onClick={(e) => {
            e.stopPropagation();
            onMenu(e.currentTarget.getBoundingClientRect());
          }}
        >
          <MoreHorizontal className="h-[15px] w-[15px]" />
        </button>
      )}
    </div>
  );
}

export function TriggerNode({ data }: NodeProps<TriggerNodeType>) {
  const { translate: t } = useTranslation();
  const ctx = useFlowContext();

  return (
    <>
      <NodeCard
        id="trigger"
        info={triggerInfo(data.trigger, ctx.lookups, t)}
        stat={ctx.triggerStat}
      />
      <Ports target={false} />
    </>
  );
}

export function StepNode({ data }: NodeProps<StepNodeType>) {
  const { translate: t } = useTranslation();
  const ctx = useFlowContext();

  return (
    <>
      <NodeCard
        id={data.step.id}
        info={stepInfo(data.step, ctx.lookups, t)}
        stat={ctx.stats?.get(data.step.id)?.entered}
        onMenu={(anchor) => ctx.stepMenu(data.step, anchor)}
      />
      <Ports />
    </>
  );
}

export function CapNode({ data }: NodeProps<CapNodeType>) {
  return (
    <div className="flex w-full justify-center">
      <span className="rounded-full bg-muted px-3 py-1 text-[11.5px] tracking-wide text-muted-foreground">
        {data.label}
      </span>
      <Ports />
    </div>
  );
}

/** Where the trunk resumes under a branching step whose paths do not rejoin.
 *  It draws nothing; it only gives the connector below something to leave. */
export function AnchorNode() {
  return (
    <div className="h-px w-px">
      <Ports target={false} />
    </div>
  );
}
