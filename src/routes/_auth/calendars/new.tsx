import { createFileRoute } from "@tanstack/react-router";
import CalendarForm from "@/components/calendar/CalendarForm";

export const Route = createFileRoute("/_auth/calendars/new")({
  component: AddCalendar,
});

function AddCalendar() {
  return <CalendarForm />;
}
