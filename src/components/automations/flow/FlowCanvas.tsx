import { useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import {
  Background,
  BackgroundVariant,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  useViewport,
} from "@xyflow/react";
import { Minus, Plus } from "lucide-react";
import type { AutomationStep, AutomationTrigger } from "@/supabase/client";
import { useTranslation } from "@/hooks/useTranslation";
import { getTranslation } from "@/i18n/translations";
import { FlowContext, type FlowContextValue } from "./context";
import FlowEdge from "./FlowEdge";
import { buildFlow, type FlowEdgeType, type FlowNode } from "./layout";
import { AnchorNode, CapNode, StepNode, TriggerNode } from "./nodes";
import "@xyflow/react/dist/style.css";
import "./flow.css";

/**
 * The canvas: a React Flow viewport over a graph derived from the definition.
 *
 * Cards size themselves to their content, and the layout needs those heights to
 * know where the next node goes — so this runs two passes. The first uses
 * estimates, React Flow measures what it rendered, and the measured heights
 * feed a second layout. It converges because the second pass only moves nodes;
 * it never changes their width, which is what their height depends on.
 */

const nodeTypes = {
  trigger: TriggerNode,
  step: StepNode,
  cap: CapNode,
  anchor: AnchorNode,
};

const edgeTypes = { flow: FlowEdge };

export default function FlowCanvas(props: {
  trigger: AutomationTrigger;
  steps: AutomationStep[];
  ctx: FlowContextValue;
}) {
  return (
    <ReactFlowProvider>
      <Canvas {...props} />
    </ReactFlowProvider>
  );
}

function Canvas({
  trigger,
  steps,
  ctx,
}: {
  trigger: AutomationTrigger;
  steps: AutomationStep[];
  ctx: FlowContextValue;
}) {
  const { currentLanguage } = useTranslation();
  const [sizes, setSizes] = useState<ReadonlyMap<string, number>>(
    () => new Map(),
  );

  // Translated from the language rather than from `useTranslation`'s
  // `translate`, which is a fresh closure on every render: depending on that
  // would rebuild the graph — and re-measure every node — forever.
  const built = useMemo(
    () =>
      buildFlow(trigger, steps, sizes, (text) =>
        getTranslation(text, currentLanguage),
      ),
    [trigger, steps, sizes, currentLanguage],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdgeType>([]);

  useEffect(() => {
    setNodes(built.nodes);
    setEdges(built.edges);
  }, [built, setNodes, setEdges]);

  // Feed measured heights back into the layout.
  useEffect(() => {
    const next = new Map<string, number>();
    for (const node of nodes) {
      const height = node.measured?.height ?? sizes.get(node.id);
      if (height != null) next.set(node.id, height);
    }

    const changed =
      next.size !== sizes.size ||
      [...next].some(([id, height]) => {
        const previous = sizes.get(id);
        return previous == null || Math.abs(previous - height) > 0.5;
      });

    if (changed) setSizes(next);
  }, [nodes, sizes]);

  // The estimated first pass is real DOM — it just has the wrong gaps in it.
  // Held back until React Flow reports its measurements so the flow appears
  // once, laid out, instead of visibly settling. One-shot: an inserted step is
  // unmeasured for a frame too, and blinking the whole canvas for it is worse
  // than the frame of settling it would hide.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (ready || nodes.length === 0) return;
    if (nodes.every((node) => node.measured?.height != null)) setReady(true);
  }, [nodes, ready]);

  const pane = useRef<HTMLDivElement>(null);
  const userMoved = useRef(false);
  useAutoFit(pane, nodes, userMoved);

  return (
    <FlowContext.Provider value={ctx}>
      <div
        ref={pane}
        className={
          "acrm-flow relative min-h-0 flex-1 transition-opacity " +
          (ready ? "opacity-100" : "opacity-0")
        }
        dir="ltr"
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          // Selection is the editor's, not React Flow's — but a node with
          // every interaction turned off is given `pointer-events: none`, so
          // this handler is also what keeps the cards clickable at all.
          onNodeClick={(_, node) => {
            if (node.type === "step" || node.type === "trigger")
              ctx.select(node.id);
          }}
          nodesDraggable={false}
          nodesConnectable={false}
          nodesFocusable={false}
          edgesFocusable={false}
          elementsSelectable={false}
          deleteKeyCode={null}
          selectionKeyCode={null}
          multiSelectionKeyCode={null}
          // A real event means the user grabbed the viewport; React Flow passes
          // null for its own programmatic moves, fitView included. From here on
          // the framing is theirs and nothing re-frames it under them.
          onMoveStart={(event) => {
            if (event) userMoved.current = true;
          }}
          panOnScroll
          zoomOnScroll={false}
          zoomOnPinch
          zoomOnDoubleClick={false}
          minZoom={0.3}
          maxZoom={1.4}
          proOptions={{ hideAttribution: false }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1.8}
            color="var(--flow-line)"
          />
        </ReactFlow>

        <ZoomBar />
      </div>
    </FlowContext.Provider>
  );
}

/**
 * Keep the flow framed in the middle of the pane.
 *
 * A single fit on open is not enough, because the two things it depends on both
 * settle after the nodes first exist: the layout takes a second pass once React
 * Flow has measured the cards, and the pane itself can still be mid-layout — a
 * fit against a pane that is briefly narrow leaves the flow stranded small and
 * off to one side, with nothing afterwards to correct it. So it re-fits on both
 * (node changes and pane resizes) instead, right up until the user pans or
 * zooms; from then on the viewport is theirs.
 */
function useAutoFit(
  pane: RefObject<HTMLDivElement | null>,
  nodes: FlowNode[],
  userMoved: RefObject<boolean>,
) {
  const { fitView } = useReactFlow();

  const laidOut =
    nodes.length > 0 && nodes.every((node) => node.measured?.height != null);

  useEffect(() => {
    const element = pane.current;
    if (!element || !laidOut || userMoved.current) return;

    let frame = 0;
    const refit = () => {
      cancelAnimationFrame(frame);
      // Next frame, so React Flow's own resize observer has stored the pane's
      // new size — fitView reads that, not the DOM.
      frame = requestAnimationFrame(() => {
        if (userMoved.current) return;
        const { width, height } = element.getBoundingClientRect();
        if (width < 1 || height < 1) return;
        void fitView({ padding: 0.2, maxZoom: 1, duration: 0 });
      });
    };

    // Fires once on observe with the current size, which is the initial fit.
    const observer = new ResizeObserver(refit);
    observer.observe(element);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [pane, nodes, laidOut, userMoved, fitView]);
}

/** The zoom control. */
function ZoomBar() {
  const { translate: t } = useTranslation();
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const { zoom } = useViewport();

  return (
    <div className="absolute bottom-[18px] left-1/2 z-[8] flex -translate-x-1/2 items-center gap-[3px] rounded-[10px] border border-border bg-card p-1 shadow-md">
      <button
        type="button"
        aria-label={t("Zoom out")}
        className="rounded-md p-1 text-muted-foreground hover:bg-muted"
        onClick={() => void zoomOut({ duration: 120 })}
      >
        <Minus className="h-[15px] w-[15px]" />
      </button>
      <b className="w-10 text-center text-xs font-medium tabular-nums text-muted-foreground">
        {Math.round(zoom * 100)}%
      </b>
      <button
        type="button"
        aria-label={t("Zoom in")}
        className="rounded-md p-1 text-muted-foreground hover:bg-muted"
        onClick={() => void zoomIn({ duration: 120 })}
      >
        <Plus className="h-[15px] w-[15px]" />
      </button>
      <button
        type="button"
        className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
        onClick={() =>
          void fitView({ padding: 0.2, maxZoom: 1, duration: 160 })
        }
      >
        {t("Fit")}
      </button>
    </div>
  );
}
