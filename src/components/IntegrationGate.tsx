import type { ReactNode } from "react";
import { Navigate } from "@tanstack/react-router";
import { LoaderCircle } from "lucide-react";
import { useAccess, type Surface } from "@/hooks/useAccess";
import useBoundStore from "@/stores/useBoundStore";

/**
 * Keeps a route's contents off screen unless the integration behind them is
 * connected, and sends a bookmarked or typed URL somewhere useful instead of
 * rendering a half-broken screen.
 *
 * The redirecting half of the pair: `HideIfNotPermitted` renders nothing and
 * moves on, this one navigates. Both read the same table in `useAccess`, so a
 * hidden button and its route can never disagree about what they require.
 *
 * Two different defaults, deliberately:
 *  - RENDER: nothing shows until the integration is known connected, so a
 *    surface can never flash in and be pulled back out a frame later.
 *  - REDIRECT: nothing navigates until `isResolved`, so a hard refresh with no
 *    session yet — or a failed fetch — leaves you where you are rather than
 *    bouncing you to `/integrations`.
 *
 * Not a `beforeLoad` redirect. The organization lives in Zustand and the
 * addresses in react-query, and neither re-runs a route lifecycle when it
 * changes, so a guard there would keep a stale surface alive after an
 * organization switch or a disconnect in another tab. A component gate is
 * reactive by construction. (The router is also created without a `context`,
 * so a loader has no `QueryClient` to reach for.)
 */
export default function IntegrationGate({
  surface,
  to = "/integrations",
  children,
}: {
  surface: Surface;
  /**
   * Where a blocked visit lands. Defaults to `/integrations` — the section that
   * is never itself gated, because it is where you connect. The stats tabs
   * override it so a typed `/stats/email` lands on the stats list rather than
   * leaving the section.
   */
  to?: "/integrations" | "/conversations" | "/stats";
  children: ReactNode;
}) {
  const orgId = useBoundStore((state) => state.ui.activeOrgId);
  const { allows, isResolved } = useAccess();

  if (allows(surface)) return <>{children}</>;

  if (!isResolved) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoaderCircle className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Navigate
      // With no organization there is nothing to connect yet, so land on the
      // app's home, whose center panel already offers "Create organization".
      to={orgId ? to : "/conversations"}
      // The hash carries the open conversation; dropping it would silently
      // close whatever chat is on screen.
      hash={(prevHash) => prevHash!}
      replace
    />
  );
}
