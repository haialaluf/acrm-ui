import { createFileRoute } from "@tanstack/react-router";
import CalendarsList from "@/components/calendar/CalendarsList";

export const Route = createFileRoute("/_auth/calendars/$calendarId")({
  component: CalendarDetail,
});

// The board itself renders in the center panel (see `_auth.tsx`); this route
// keeps the calendars master list in the left panel with the open one selected.
function CalendarDetail() {
  const { calendarId } = Route.useParams();
  return <CalendarsList activeId={calendarId} />;
}
