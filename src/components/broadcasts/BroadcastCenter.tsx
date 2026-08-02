import { useLocation } from "@tanstack/react-router";
import BroadcastBatchDetail from "./BroadcastBatchDetail";
import { decodeBatchKey } from "./batchKey";

// Reads the open batch key from the path and renders its detail in the center
// panel — the broadcasts analogue of CalendarCenter/StatsCenter. Returns null
// on bare `/broadcasts`, which has no detail.
export default function BroadcastCenter() {
  const pathname = useLocation({ select: (l) => l.pathname });
  const match = pathname.match(/^\/broadcasts\/([^/]+)$/);
  const batchKey = match?.[1];
  if (!batchKey) return null;

  const { createdAt, scheduledDate } = decodeBatchKey(batchKey);
  return (
    <BroadcastBatchDetail
      key={batchKey}
      createdAt={createdAt}
      scheduledDate={scheduledDate}
    />
  );
}
