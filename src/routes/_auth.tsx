import { createFileRoute, Navigate, Outlet } from "@tanstack/react-router";
import useBoundStore from "@/stores/useBoundStore";
import Menu from "@/components/Menu";
import Chat from "@/components/Chat";
import ChatHeader from "@/components/ChatHeader";
import ChatFooter from "@/components/ChatFooter";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "@tanstack/react-router";
import FilePicker from "@/components/FileUploader/FilePicker";
import FilePreviewer from "@/components/FilePreviewer";
import ActionCard from "@/components/ActionCard";
import { useTranslation } from "@/hooks/useTranslation";
import {
  Bot,
  Building2,
  LoaderCircle,
  MessageSquarePlus,
  Unplug,
} from "lucide-react";
import HideIfNotPermitted from "@/components/HideIfNotPermitted";
import { GATED_SECTIONS, useAccess } from "@/hooks/useAccess";
import { useResizable } from "@/hooks/useResizable";
import { isRtl, type Language } from "@/stores/uiSlice";
import { useCurrentAgents } from "@/queries/useAgents";
import StatsCenter from "@/components/stats/StatsCenter";
import CalendarCenter from "@/components/calendar/CalendarCenter";
import BroadcastCenter from "@/components/broadcasts/BroadcastCenter";
import LiveMessagePreview from "@/components/messagePreview/LiveMessagePreview";
import PlanLimitBanner from "@/components/PlanLimitBanner";

export const Route = createFileRoute("/_auth")({
  component: AppLayout,
});

const MIN_PANEL_WIDTH = 300;

function getMenuWidth() {
  return window.innerWidth >= 1024 ? 64 : 48;
}

function getMaxPanelWidth() {
  // Max is 1/2 of available space (equal to chat panel)
  const availableSpace = window.innerWidth - getMenuWidth();
  return Math.floor(availableSpace / 2);
}

function AppLayout() {
  const { translate: t, currentLanguage } = useTranslation();
  const activeOrgId = useBoundStore((state) => state.ui.activeOrgId);
  const { data: agents } = useCurrentAgents();
  const hasAiAgents = agents?.some((a) => a.ai);
  const { allows, isResolved } = useAccess();
  // The one surface read inverted: this card exists *because* nothing is
  // connected. Gated on `isResolved` too, so an organization that turns out to
  // have everything connected is not shown it for a frame on every load.
  const needsIntegrations =
    isResolved && !allows("app.connected") && !!activeOrgId;
  const activeThreadKey = useBoundStore((state) => state.ui.activeThreadKey);
  const panelExpanded = useBoundStore((state) => state.ui.panelExpanded);
  const setActiveThread = useBoundStore((state) => state.ui.setActiveThread);
  const location = useLocation();
  const pathname = location.pathname;
  const isStatsRoute = pathname.startsWith("/stats");
  // A specific stats tab (Quotas/Usage). On mobile this opens the center panel
  // full-screen; bare `/stats` instead stays on the list + menu so the section
  // is navigable (the list is hidden alongside the center panel on mobile).
  const isStatsDetail =
    pathname === "/stats/quotas" ||
    pathname === "/stats/usage" ||
    pathname === "/stats/health";
  // An open calendar (`/calendars/<id>`, but not `/calendars/new`) shows its
  // react-big-calendar board in the wide center panel, master-detail style.
  const isCalendarBoardRoute = /^\/calendars\/(?!new$)[^/]+$/.test(pathname);
  // An open broadcast batch (`/broadcasts/<batchKey>`) shows its stats +
  // recipient list in the center panel, master-detail style like calendars.
  const isBroadcastDetailRoute = /^\/broadcasts\/[^/]+$/.test(pathname);
  // Create/edit WhatsApp template routes (.../templates/new or
  // .../templates/$id, but not the list at .../templates). The live phone
  // preview fills the otherwise empty center panel on desktop; on mobile it
  // stacks inside the form panel.
  //
  // The email builder's paths carry an extra segment (/templates/email/<id>),
  // which is what keeps them out of this regex — do not loosen it to `.*`, or
  // an email builder gets a WhatsApp phone preview bolted to its side.
  const isTemplateEditorRoute = /\/templates\/(?!email\/)[^/]+$/.test(pathname);
  // The email builder is a three-column app of its own (our panel, canvas, the
  // vendor's sidebar) and has no use for a center panel, so it takes the whole
  // width to the right of the menu instead of living in the left panel.
  const isEmailBuilderRoute = /^\/templates\/email\/[^/]+$/.test(pathname);
  // An open automation (`/automations/<id>`) is a canvas plus its own config
  // drawer — the same two-column app shape the email builder has, and with the
  // same lack of anything to put in a center panel. The list at
  // `/automations` stays an ordinary left-panel page.
  const isAutomationEditorRoute = /^\/automations\/[^/]+$/.test(pathname);
  // Both full-width routes get identical layout treatment; kept as one flag so
  // the four places below cannot drift apart.
  const isFullWidthRoute = isEmailBuilderRoute || isAutomationEditorRoute;

  /**
   * Redirect out of a section this organization cannot use yet.
   *
   * The rules live in the SURFACES table so the nav rail reads the same rows
   * instead of a hand-copied set; this file only decides what to do when a row
   * is unmet. Enforced around the one `<Outlet />` rather than route by route,
   * so a new route cannot forget to guard itself.
   *
   * The no-organization case is never gated: there is nothing to connect yet,
   * and the center panel below already answers it with "Create organization".
   */
  const gatedSection = GATED_SECTIONS.find((prefix) =>
    pathname.startsWith(prefix),
  );
  const blockedForNoIntegrations =
    !!activeOrgId && isResolved && !!gatedSection && !allows(gatedSection);
  // Hold rather than render: showing the section and pulling it away a frame
  // later is exactly the flash the gates elsewhere exist to prevent. Only the
  // gated sections wait; everything else renders immediately.
  const holdingForIntegrations = !!activeOrgId && !isResolved && !!gatedSection;

  const [isHoveringFiles, setIsHoveringFiles] = useState(false);

  const {
    width: panelWidth,
    panelRef,
    handleMouseDown,
    setWidth: setPanelWidth,
    isResizing,
  } = useResizable({
    minWidth: MIN_PANEL_WIDTH,
    getMaxWidth: getMaxPanelWidth,
    isRtl: isRtl(currentLanguage as Language),
  });

  // The template editor is a wide form next to a narrow phone preview, so it
  // snaps the panel to the widest the drag handle allows; leaving restores
  // whatever width was in effect before. Two ways in: the standalone editor
  // route, or `panelExpanded` — set by editors rendered *inside* the panel
  // (ManageTemplatesOverlay), which change no route at all.
  const shouldExpandPanel = isTemplateEditorRoute || panelExpanded;
  const wasExpandedRef = useRef(false);
  const widthBeforeExpandRef = useRef<number | null>(null);
  useEffect(() => {
    if (shouldExpandPanel === wasExpandedRef.current) return;
    wasExpandedRef.current = shouldExpandPanel;

    if (shouldExpandPanel) {
      widthBeforeExpandRef.current = panelWidth;
      setPanelWidth(getMaxPanelWidth());
    } else {
      setPanelWidth(widthBeforeExpandRef.current);
    }
  }, [shouldExpandPanel, panelWidth, setPanelWidth]);

  // Sync fragment identifier with activeThreadKey
  // i.e. /conversations#318232498042593~5551000
  useEffect(() => {
    setActiveThread(location.hash || null);
  }, [location.hash]);

  const showCenterPanel =
    (activeThreadKey ||
      isStatsDetail ||
      isCalendarBoardRoute ||
      isBroadcastDetailRoute) &&
    !isTemplateEditorRoute &&
    !isFullWidthRoute;

  // The grid owns the viewport on its own (height:100dvh/width:100vw in CSS);
  // the plan-limit banner sits above it, so hand the grid the remaining space
  // instead — inline height/width win over the stylesheet.
  const gridStyle = {
    height: "100%",
    width: "100%",
    ...(isFullWidthRoute
      ? // Two columns: the menu, then the builder across the rest. The third
        // track is collapsed rather than removed so the grid keeps animating
        // between shapes instead of snapping.
        { gridTemplateColumns: `${getMenuWidth()}px 1fr 0px` }
      : panelWidth !== null
        ? { gridTemplateColumns: `${getMenuWidth()}px ${panelWidth}px 1fr` }
        : null),
  };

  return (
    <div className="flex h-[100dvh] w-screen flex-col overflow-hidden">
      <PlanLimitBanner />
      <div
        className={"app-grid" + (isResizing ? "" : " animate-columns")}
        style={gridStyle}
      >
        {/* Menu - Fixed width */}
        <div className={showCenterPanel ? "hidden md:flex" : "flex"}>
          <Menu />
        </div>
        {/* Left Panel - Router Outlet */}
        <div
          ref={panelRef}
          className={
            "flex-col overflow-hidden border-border bg-background text-foreground col-span-2 md:col-span-1 relative " +
            // No divider when this column is the last one on screen.
            (isFullWidthRoute ? "" : "md:border-r ") +
            (showCenterPanel ? "hidden md:flex" : "flex")
          }
        >
          {blockedForNoIntegrations ? (
            <Navigate
              to="/integrations"
              hash={(prevHash) => prevHash!}
              replace
            />
          ) : holdingForIntegrations ? (
            <div className="flex h-full items-center justify-center">
              <LoaderCircle className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <Outlet />
          )}
          {/* Resize Handle — a full-width route (email builder, automation
            editor) owns its whole column, so there is no boundary to drag. */}
          {!isFullWidthRoute && (
            <div
              className="resize-handle z-[60]"
              onMouseDown={handleMouseDown}
            />
          )}
        </div>

        {/* Center Panel */}
        <div
          className={
            "flex-col min-w-0 relative overflow-hidden col-span-full md:col-span-1" +
            (isFullWidthRoute
              ? // Its column is 0px wide; keep it out of the layout entirely so a
                // stray open conversation cannot paint a sliver beside the canvas.
                " hidden"
              : isTemplateEditorRoute
                ? " hidden md:flex bg-muted"
                : isStatsRoute
                  ? isStatsDetail
                    ? " flex bg-muted"
                    : " hidden md:flex bg-muted"
                  : isCalendarBoardRoute
                    ? " flex bg-background"
                    : isBroadcastDetailRoute
                      ? " flex bg-background"
                      : activeThreadKey
                        ? " flex bg-chat"
                        : " hidden md:flex bg-muted")
          }
          onDragEnter={() => setIsHoveringFiles(true)}
          onDrop={() => setIsHoveringFiles(false)}
        >
          {isTemplateEditorRoute ? (
            <div className="flex items-center justify-center h-full overflow-auto">
              <LiveMessagePreview variant="phone" />
            </div>
          ) : isStatsRoute ? (
            <div className="overflow-y-auto h-full">
              <StatsCenter />
            </div>
          ) : isCalendarBoardRoute ? (
            <CalendarCenter />
          ) : isBroadcastDetailRoute ? (
            <BroadcastCenter />
          ) : activeThreadKey ? (
            <>
              {isHoveringFiles && (
                <FilePicker setHovering={setIsHoveringFiles} />
              )}
              <FilePreviewer />
              <ChatHeader />
              <Chat />
              <ChatFooter />
            </>
          ) : (
            <div className="flex gap-[32px] items-center justify-center h-full">
              {!activeOrgId && (
                <ActionCard
                  icon={<Building2 className="w-[24px] h-[24px]" />}
                  title={t("Create organization")}
                  to="/settings/organization/new"
                />
              )}
              {activeOrgId && (
                <>
                  {/* An agent with no channel to answer on has nothing to do, so
                    connecting comes first. */}
                  {!hasAiAgents && (
                    <ActionCard
                      icon={<Bot className="w-[24px] h-[24px]" />}
                      title={t("Create agent")}
                      to="/agents/new"
                    />
                  )}
                  {hasAiAgents && (
                    <HideIfNotPermitted surface="home.startConversation">
                      <ActionCard
                        icon={
                          <MessageSquarePlus className="w-[24px] h-[24px]" />
                        }
                        title={t("Start conversation")}
                        to="/conversations/bulk-send"
                      />
                    </HideIfNotPermitted>
                  )}
                  {/* Names no particular integration — a card that said
                    "Configure WhatsApp" would be advertising a channel to
                    someone who may want any of the other five. Suppressed on
                    /integrations itself, where the list beside it is already the
                    answer and the card would only point at the current page. */}
                  {needsIntegrations &&
                    !pathname.startsWith("/integrations") && (
                      <ActionCard
                        icon={<Unplug className="w-[24px] h-[24px]" />}
                        title={t("Integrations")}
                        to="/integrations"
                      />
                    )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
