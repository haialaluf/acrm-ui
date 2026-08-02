import { createFileRoute } from "@tanstack/react-router";
import BroadcastsList from "@/components/broadcasts/BroadcastsList";

export const Route = createFileRoute("/_auth/broadcasts/$batchKey")({
  component: BroadcastDetail,
});

// The detail itself renders in the center panel (see BroadcastCenter, wired
// from _auth.tsx); this route keeps the broadcasts master list in the left
// panel with the open batch selected — same split as calendars/$calendarId.
function BroadcastDetail() {
  const { batchKey } = Route.useParams();
  return <BroadcastsList activeKey={batchKey} />;
}
