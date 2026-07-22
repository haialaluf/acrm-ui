import { createFileRoute } from "@tanstack/react-router";
import CalendarsList from "@/components/calendar/CalendarsList";

export const Route = createFileRoute("/_auth/calendars/")({
  component: ListCalendars,
});

function ListCalendars() {
  return <CalendarsList />;
}
