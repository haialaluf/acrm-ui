import { StatusBadge } from "acrm-ui";

export const Tones = () => (
  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: 16 }}>
    <StatusBadge label="scheduled" tone="primary" />
    <StatusBadge label="sending" tone="warning" />
    <StatusBadge label="sent" tone="success" />
    <StatusBadge label="draft" tone="neutral" />
    <StatusBadge label="cancelled" tone="destructive" />
  </div>
);
