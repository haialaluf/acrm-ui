import { createFileRoute, Outlet } from "@tanstack/react-router";
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
import { Bot, Building2, MessageSquarePlus, Settings } from "lucide-react";
import { useResizable } from "@/hooks/useResizable";
import { isRtl, type Language } from "@/stores/uiSlice";
import { useCurrentAgents } from "@/queries/useAgents";
import StatsCenter from "@/components/stats/StatsCenter";
import CalendarCenter from "@/components/calendar/CalendarCenter";
import LiveMessagePreview from "@/components/messagePreview/LiveMessagePreview";

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
    pathname === "/stats/quotas" || pathname === "/stats/usage";
  // An open calendar (`/calendars/<id>`, but not `/calendars/new`) shows its
  // react-big-calendar board in the wide center panel, master-detail style.
  const isCalendarBoardRoute = /^\/calendars\/(?!new$)[^/]+$/.test(pathname);
  // Create/edit template routes (.../templates/new or .../templates/$id, but
  // not the list at .../templates). The live phone preview fills the otherwise
  // empty center panel on desktop; on mobile it stacks inside the form panel.
  const isTemplateEditorRoute = /\/templates\/[^/]+$/.test(pathname);

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
    (activeThreadKey || isStatsDetail || isCalendarBoardRoute) &&
    !isTemplateEditorRoute;

  return (
    <div
      className={"app-grid" + (isResizing ? "" : " animate-columns")}
      style={
        panelWidth !== null
          ? { gridTemplateColumns: `${getMenuWidth()}px ${panelWidth}px 1fr` }
          : undefined
      }
    >
      {/* Menu - Fixed width */}
      <div className={showCenterPanel ? "hidden md:flex" : "flex"}>
        <Menu />
      </div>
      {/* Left Panel - Router Outlet */}
      <div
        ref={panelRef}
        className={
          "flex-col overflow-hidden md:border-r border-border bg-background text-foreground col-span-2 md:col-span-1 relative " +
          (showCenterPanel ? "hidden md:flex" : "flex")
        }
      >
        <Outlet />
        {/* Resize Handle */}
        <div className="resize-handle z-[60]" onMouseDown={handleMouseDown} />
      </div>

      {/* Center Panel */}
      <div
        className={
          "flex-col min-w-0 relative overflow-hidden col-span-full md:col-span-1" +
          (isTemplateEditorRoute
            ? " hidden md:flex bg-muted"
            : isStatsRoute
              ? isStatsDetail
                ? " flex bg-muted"
                : " hidden md:flex bg-muted"
              : isCalendarBoardRoute
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
        ) : activeThreadKey ? (
          <>
            {isHoveringFiles && <FilePicker setHovering={setIsHoveringFiles} />}
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
                {!hasAiAgents && (
                  <ActionCard
                    icon={<Bot className="w-[24px] h-[24px]" />}
                    title={t("Create agent")}
                    to="/agents/new"
                  />
                )}
                {hasAiAgents && (
                  <ActionCard
                    icon={<MessageSquarePlus className="w-[24px] h-[24px]" />}
                    title={t("Start conversation")}
                    to="/conversations/bulk-send"
                  />
                )}
                <ActionCard
                  icon={<Settings className="w-[24px] h-[24px]" />}
                  title={t("Configure WhatsApp")}
                  to="/integrations/whatsapp/new"
                />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
