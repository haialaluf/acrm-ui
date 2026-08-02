import { createFileRoute } from "@tanstack/react-router";
import BroadcastsList from "@/components/broadcasts/BroadcastsList";

export const Route = createFileRoute("/_auth/broadcasts/")({
  component: ListBroadcasts,
});

function ListBroadcasts() {
  return <BroadcastsList />;
}
