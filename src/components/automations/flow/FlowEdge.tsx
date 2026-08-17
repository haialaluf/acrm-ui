import {
  BaseEdge,
  EdgeLabelRenderer,
  type EdgeProps,
  getSmoothStepPath,
} from "@xyflow/react";
import { Plus } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useFlowContext } from "./context";
import type { FlowEdgeType } from "./layout";

/**
 * A connector, and everything that used to live in the gap between two cards:
 * the insert button, and the branch name when the connector is the one that
 * opens a column.
 *
 * The `+` sits at the elbow of the step path and stays faintly visible instead
 * of appearing only on hover — with the whole diagram now inside a pannable
 * viewport, a control you can only find by hovering the exact pixels it will
 * appear at is a control nobody finds.
 */
export default function FlowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps<FlowEdgeType>) {
  const { translate: t } = useTranslation();
  const ctx = useFlowContext();

  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 14,
  });

  const insert = data?.insert;

  return (
    <>
      <BaseEdge id={id} path={path} />

      <EdgeLabelRenderer>
        {data?.label && (
          <div
            title={data.label}
            style={{
              transform: `translate(-50%, -50%) translate(${targetX}px, ${targetY - 26}px)`,
            }}
            className={
              "nodrag nopan pointer-events-none absolute max-w-[280px] truncate rounded-full border border-border bg-card px-[9px] py-[2px] text-[11.5px] tabular-nums " +
              (data.strong
                ? "font-semibold text-foreground"
                : "text-muted-foreground")
            }
          >
            {data.label}
          </div>
        )}

        {insert && (
          <button
            type="button"
            title={t("Insert step")}
            aria-label={t("Insert step")}
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
            // No transform-based hover effect, and nothing transitioning
            // `transform`: the button is positioned by a `transform` of its
            // own, so a `scale` composes with that offset and throws the
            // button off the edge instead of growing it in place.
            className={
              "nodrag nopan pointer-events-auto absolute flex h-5 w-5 items-center justify-center rounded-full border bg-card p-0 transition-[opacity,color,background-color,border-color] hover:border-primary hover:bg-primary hover:text-white " +
              (insert.always
                ? "border-primary text-primary"
                : "border-border text-muted-foreground opacity-40 hover:opacity-100 focus-visible:opacity-100")
            }
            onClick={(e) => {
              e.stopPropagation();
              ctx.insert(
                insert.path,
                insert.index,
                e.currentTarget.getBoundingClientRect(),
              );
            }}
          >
            <Plus className="h-3 w-3" />
          </button>
        )}
      </EdgeLabelRenderer>
    </>
  );
}
