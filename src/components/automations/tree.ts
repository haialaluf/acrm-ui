import type { AutomationStep } from "@/supabase/client";

/**
 * Immutable edits to the step tree.
 *
 * Every function returns a new tree rather than mutating in place, so the
 * editor can hold the whole definition in one `useState` and let React compare
 * by reference. The engine reads the same shape (see the API's
 * automation-engine/tree.ts, which navigates it); these are only the editing
 * half.
 *
 * A `path` is the chain of `[stepId, branchId, stepId, branchId, ...]` that
 * locates a nested step list — the flat form the tree components already pass
 * down as they render.
 */

/** Replace the step list at `path` with the result of `fn`. */
export function updateAt(
  steps: AutomationStep[],
  path: string[],
  fn: (list: AutomationStep[]) => AutomationStep[],
): AutomationStep[] {
  if (path.length === 0) return fn(steps);

  const [stepId, branchId, ...rest] = path;

  return steps.map((step) => {
    if (step.id !== stepId || !("branches" in step)) return step;

    return {
      ...step,
      branches: step.branches.map((branch) =>
        branch.id === branchId
          ? { ...branch, steps: updateAt(branch.steps, rest, fn) }
          : branch,
      ),
    } as AutomationStep;
  });
}

/** Replace one step anywhere in the tree, found by id. */
export function mapStep(
  steps: AutomationStep[],
  id: string,
  fn: (step: AutomationStep) => AutomationStep,
): AutomationStep[] {
  return steps.map((step) => {
    if (step.id === id) return fn(step);

    if ("branches" in step) {
      return {
        ...step,
        branches: step.branches.map((branch) => ({
          ...branch,
          steps: mapStep(branch.steps, id, fn),
        })),
      } as AutomationStep;
    }

    return step;
  });
}

export function findStep(
  steps: AutomationStep[],
  id: string,
): AutomationStep | null {
  for (const step of steps) {
    if (step.id === id) return step;

    if ("branches" in step) {
      for (const branch of step.branches) {
        const found = findStep(branch.steps, id);
        if (found) return found;
      }
    }
  }

  return null;
}

export function removeStep(
  steps: AutomationStep[],
  id: string,
): AutomationStep[] {
  return steps
    .filter((step) => step.id !== id)
    .map((step) =>
      "branches" in step
        ? ({
            ...step,
            branches: step.branches.map((branch) => ({
              ...branch,
              steps: removeStep(branch.steps, id),
            })),
          } as AutomationStep)
        : step,
    );
}

/**
 * A deep copy with fresh ids.
 *
 * Duplicating a branching step has to re-id its whole subtree: two steps
 * sharing an id would make a run's cursor ambiguous, and `mapStep` above would
 * edit both at once.
 */
export function duplicateStep(step: AutomationStep): AutomationStep {
  const copy = { ...step, id: crypto.randomUUID().slice(0, 8) };

  if ("branches" in copy) {
    return {
      ...copy,
      branches: copy.branches.map((branch) => ({
        ...branch,
        id: crypto.randomUUID().slice(0, 8),
        steps: branch.steps.map(duplicateStep),
      })),
    } as AutomationStep;
  }

  return copy;
}

/** Total steps in the tree, branches included — the list's "N steps" figure. */
export function countSteps(steps: AutomationStep[]): number {
  return steps.reduce(
    (total, step) =>
      total +
      1 +
      ("branches" in step
        ? step.branches.reduce((n, b) => n + countSteps(b.steps), 0)
        : 0),
    0,
  );
}
