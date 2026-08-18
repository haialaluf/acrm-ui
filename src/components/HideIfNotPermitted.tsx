import type { ReactNode } from "react";
import { useAccess, type Surface } from "@/hooks/useAccess";

/**
 * Renders its children only where the organization has connected what the
 * surface needs, per the table in `useAccess`.
 *
 * For UI that offers something — a nav button, a create button, a tab. The
 * requirement itself is not written here: the call site names the surface, the
 * table says what that surface costs, so a rule can never drift between the
 * button and the route it points at.
 *
 * Hides while the answer is still unknown, deliberately, and without a spinner:
 * an icon that appears a beat late is invisible, one that appears and vanishes
 * is not. That is the whole difference from `IntegrationGate`, which must wait
 * for `isResolved` because bouncing a bookmarked URL is not recoverable the way
 * a late-arriving button is.
 */
export default function HideIfNotPermitted({
  surface,
  children,
}: {
  surface: Surface;
  children: ReactNode;
}) {
  const { allows } = useAccess();

  return allows(surface) ? <>{children}</> : null;
}
