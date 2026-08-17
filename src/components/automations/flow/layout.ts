import type { Edge, Node } from "@xyflow/react";
import type { AutomationStep, AutomationTrigger } from "@/supabase/client";
import type { Translate } from "../summaries";

/**
 * The definition → graph pass.
 *
 * React Flow renders nodes at absolute coordinates and lays out nothing itself,
 * so the tree shape the old CSS grid produced for free is computed here instead.
 * The rules are the same ones that shape mattered for: a branching step fans out
 * into parallel columns, and columns that rejoin visibly arrive back at the
 * trunk — a 10% holdout path with no steps in it still reaches the step below
 * the split.
 *
 * Nothing here reads a stored position. The graph is a pure function of the
 * definition (plus measured heights), so the canvas can never end up in a state
 * a saved coordinate has to be reconciled with.
 */

/** Every node is this wide, caps included — they centre a pill inside a
 *  full-width transparent box. One width for everything is what lets a column
 *  be laid out at x=0 and then slid sideways by translating positions. */
export const NODE_W = 302;

const V_GAP = 54; // trunk connector: node bottom → next node top
const COL_GAP = 44; // between sibling branch columns
const BRANCH_GAP = 92; // branching step → the top of its columns
const MERGE_EXTRA = 30; // deepest column → the rejoin cap
const EST_STEP_H = 78; // used for the first paint, before measurement
const EST_CAP_H = 26;

export type InsertPoint = {
  /** `[stepId, branchId, …]` — the list the new step goes into. */
  path: string[];
  index: number;
  /** Empty branches keep their `+` lit; everywhere else it sits back. */
  always?: boolean;
};

export type FlowEdgeData = {
  insert?: InsertPoint;
  /** Branch name, printed above the column it opens. */
  label?: string;
  /** A percentage split labels its paths louder than an if/else does. */
  strong?: boolean;
};

export type StepNodeType = Node<{ step: AutomationStep }, "step">;
export type TriggerNodeType = Node<{ trigger: AutomationTrigger }, "trigger">;
export type CapNodeType = Node<{ label: string }, "cap">;
export type AnchorNodeType = Node<Record<string, unknown>, "anchor">;
export type FlowNode =
  | StepNodeType
  | TriggerNodeType
  | CapNodeType
  | AnchorNodeType;
export type FlowEdgeType = Edge<FlowEdgeData, "flow">;

type Emit = { nodes: FlowNode[]; edges: FlowEdgeType[] };
/** Horizontal extent of a subtree, in absolute canvas coordinates. */
type Span = { left: number; right: number };
type Ctx = { sizes: ReadonlyMap<string, number>; t: Translate };
type Placed = { bottomId: string; nextY: number; span: Span };

const heightOf = (ctx: Ctx, id: string, fallback: number) =>
  ctx.sizes.get(id) ?? fallback;

/** `x` is the node's centre; React Flow wants its top-left. */
function place(
  node: Omit<FlowNode, "position"> & { position?: never },
  x: number,
  y: number,
): FlowNode {
  return {
    ...node,
    position: { x: x - NODE_W / 2, y },
    style: { width: NODE_W },
    draggable: false,
    selectable: false,
  } as FlowNode;
}

const cap = (id: string, label: string, x: number, y: number): FlowNode =>
  place({ id, type: "cap", data: { label } }, x, y);

const link = (
  source: string,
  target: string,
  data: FlowEdgeData,
): FlowEdgeType => ({
  id: `${source}->${target}`,
  source,
  target,
  type: "flow",
  data,
});

const insertLink = (
  source: string,
  target: string,
  path: string[],
  index: number,
  always?: boolean,
) => link(source, target, { insert: { path, index, always } });

/** A step list: one node per step, chained by connectors that each carry the
 *  insert position they sit at. Returns where the next thing below attaches. */
function layoutStack(
  steps: AutomationStep[],
  path: string[],
  x: number,
  yTop: number,
  incomingId: string,
  e: Emit,
  ctx: Ctx,
): Placed {
  const span: Span = { left: x - NODE_W / 2, right: x + NODE_W / 2 };
  let bottomId = incomingId;
  let y = yTop;

  steps.forEach((step, index) => {
    e.edges.push(insertLink(bottomId, step.id, path, index));

    const placed = layoutStep(step, path, x, y, e, ctx);
    span.left = Math.min(span.left, placed.span.left);
    span.right = Math.max(span.right, placed.span.right);
    bottomId = placed.bottomId;
    y = placed.nextY;
  });

  return { bottomId, nextY: y, span };
}

function layoutStep(
  step: AutomationStep,
  path: string[],
  x: number,
  y: number,
  e: Emit,
  ctx: Ctx,
): Placed {
  const height = heightOf(ctx, step.id, EST_STEP_H);
  const own: Span = { left: x - NODE_W / 2, right: x + NODE_W / 2 };

  e.nodes.push(place({ id: step.id, type: "step", data: { step } }, x, y));

  // A branching step with no paths left in it is still a step: treated as a
  // leaf here rather than laying out an empty row of columns, which would make
  // every coordinate below it NaN.
  if (!("branches" in step) || step.branches.length === 0) {
    return { bottomId: step.id, nextY: y + height + V_GAP, span: own };
  }

  const branching = step;
  const columnTop = y + height + BRANCH_GAP;

  // Computed here, where `step.type` still narrows the branch union: inside the
  // loop TypeScript only sees `SplitBranch | ConditionBranch`, and only a split
  // branch carries a percentage.
  const labels =
    branching.type === "split"
      ? branching.branches.map((branch) => `${branch.pct}% · ${branch.name}`)
      : branching.branches.map((branch) => branch.name);

  // Each column is laid out around x=0 into its own buffer, then slid into
  // place once every column's width is known.
  const columns = branching.branches.map((branch, index) => {
    const sub: Emit = { nodes: [], edges: [] };
    const branchPath = [...path, branching.id, branch.id];
    const empty = branch.steps.length === 0;

    const stack = layoutStack(
      branch.steps,
      branchPath,
      0,
      columnTop,
      branching.id,
      sub,
      ctx,
    );

    let tailId = stack.bottomId;
    let nextY = stack.nextY;

    // An empty column still gets a cap, and not only to explain itself: it is
    // what gives the column a node of its own. Two empty sibling columns
    // sharing the branching step as both ends would collapse into one edge.
    if (empty) {
      const capId = `cap:empty:${branching.id}:${branch.id}`;
      sub.nodes.push(
        cap(capId, ctx.t("Empty path — contacts fall through"), 0, nextY),
      );
      sub.edges.push(insertLink(tailId, capId, branchPath, 0, true));
      tailId = capId;
      nextY += heightOf(ctx, capId, EST_CAP_H) + V_GAP;
    } else if (!branching.rejoin) {
      const capId = `cap:end:${branching.id}:${branch.id}`;
      sub.nodes.push(cap(capId, ctx.t("End of path"), 0, nextY));
      sub.edges.push(
        insertLink(tailId, capId, branchPath, branch.steps.length),
      );
      tailId = capId;
      nextY += heightOf(ctx, capId, EST_CAP_H) + V_GAP;
    }

    // The branch name rides on the first connector out of the branching step,
    // which is the one that opens this column.
    const head = sub.edges.find((edge) => edge.source === branching.id);
    if (head) {
      head.data = {
        ...head.data,
        label: labels[index],
        strong: branching.type === "split",
      };
    }

    return {
      sub,
      span: stack.span,
      tailId,
      nextY,
      branchPath,
      count: branch.steps.length,
      empty,
    };
  });

  const widths = columns.map((column) => column.span.right - column.span.left);
  const total =
    widths.reduce((sum, width) => sum + width, 0) +
    COL_GAP * (columns.length - 1);

  let cursor = x - total / 2;
  columns.forEach((column, index) => {
    const dx = cursor - column.span.left;
    for (const node of column.sub.nodes) node.position.x += dx;
    e.nodes.push(...column.sub.nodes);
    e.edges.push(...column.sub.edges);
    cursor += widths[index] + COL_GAP;
  });

  const span: Span = {
    left: Math.min(own.left, x - total / 2),
    right: Math.max(own.right, x + total / 2),
  };
  const deepest = Math.max(...columns.map((column) => column.nextY));

  if (branching.rejoin) {
    const mergeId = `merge:${branching.id}`;
    const mergeY = deepest + MERGE_EXTRA;

    e.nodes.push(cap(mergeId, ctx.t("all paths continue"), x, mergeY));

    for (const column of columns) {
      // An empty column already spent its insert point on the edge into its
      // cap; a second `+` here would mean the same thing twice.
      e.edges.push(
        column.empty
          ? link(column.tailId, mergeId, {})
          : insertLink(column.tailId, mergeId, column.branchPath, column.count),
      );
    }

    return {
      bottomId: mergeId,
      nextY: mergeY + heightOf(ctx, mergeId, EST_CAP_H) + V_GAP,
      span,
    };
  }

  // Nothing rejoins, but the parent trunk still resumes below the columns —
  // an invisible node is what the connector after this step leaves from.
  const anchorId = `anchor:${branching.id}`;
  e.nodes.push({
    id: anchorId,
    type: "anchor",
    position: { x, y: deepest },
    data: {},
    draggable: false,
    selectable: false,
  });

  return { bottomId: anchorId, nextY: deepest + V_GAP, span };
}

export function buildFlow(
  trigger: AutomationTrigger,
  steps: AutomationStep[],
  sizes: ReadonlyMap<string, number>,
  t: Translate,
): { nodes: FlowNode[]; edges: FlowEdgeType[] } {
  const e: Emit = { nodes: [], edges: [] };
  const ctx: Ctx = { sizes, t };

  e.nodes.push(
    place({ id: "trigger", type: "trigger", data: { trigger } }, 0, 0),
  );

  const stack = layoutStack(
    steps,
    [],
    0,
    heightOf(ctx, "trigger", EST_STEP_H) + V_GAP,
    "trigger",
    e,
    ctx,
  );

  const endId = "cap:flow";
  e.nodes.push(cap(endId, t("End of flow"), 0, stack.nextY));
  e.edges.push(
    insertLink(stack.bottomId, endId, [], steps.length, steps.length === 0),
  );

  return e;
}
