import { createFileRoute } from "@tanstack/react-router";
import CalendarForm from "@/components/calendar/CalendarForm";
import { useCalendar } from "@/queries/useCalendars";

export const Route = createFileRoute("/_auth/calendars/edit/$calendarId")({
  component: EditCalendar,
});

function EditCalendar() {
  const { calendarId } = Route.useParams();
  const { data: calendar } = useCalendar(calendarId);

  // Wait for the calendar before mounting the form so its fields seed once.
  if (!calendar) return null;
  return <CalendarForm calendar={calendar} />;
}
