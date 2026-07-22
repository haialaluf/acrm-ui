import { useLocation } from "@tanstack/react-router";
import CalendarBoard from "./CalendarBoard";

// Reads the open calendar id from the path and renders its board in the center
// panel — the calendars analogue of StatsCenter. Returns null on `/calendars`
// and `/calendars/new`, which have no board.
export default function CalendarCenter() {
  const pathname = useLocation({ select: (l) => l.pathname });
  const match = pathname.match(/^\/calendars\/([^/]+)$/);
  const calendarId = match?.[1];
  if (!calendarId || calendarId === "new") return null;
  return <CalendarBoard key={calendarId} calendarId={calendarId} />;
}
