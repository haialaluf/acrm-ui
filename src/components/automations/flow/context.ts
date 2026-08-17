import { createContext, useContext } from "react";
import type { AutomationStep } from "@/supabase/client";
import type { Lookups } from "../summaries";

/**
 * What the canvas needs to render and edit a node.
 *
 * It travels by context rather than in each node's `data`, because node data is
 * part of the graph the layout rebuilds: threading callbacks and live stats
 * through it would re-key every node whenever any of them changed.
 */

export type StepStat = { entered: number; failed: number };

export type FlowContextValue = {
  /** A step id, or the literal `"trigger"`. */
  selectedId: string | null;
  showStats: boolean;
  stats?: Map<string, StepStat>;
  triggerStat?: number;
  lookups: Lookups;
  select: (id: string) => void;
  /** Open the insert menu for position `index` of the list at `path`. */
  insert: (path: string[], index: number, anchor: DOMRect) => void;
  stepMenu: (step: AutomationStep, anchor: DOMRect) => void;
};

export const FlowContext = createContext<FlowContextValue | null>(null);

export function useFlowContext(): FlowContextValue {
  const value = useContext(FlowContext);
  if (!value) throw new Error("Flow nodes must render inside a FlowCanvas");
  return value;
}
