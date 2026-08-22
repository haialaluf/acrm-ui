import { Chip } from "acrm-ui";

export const Tones = () => (
  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: 16 }}>
    <Chip tone="success" dot>Healthy</Chip>
    <Chip tone="warning" dot>Rate limited</Chip>
    <Chip tone="destructive" dot>Blocked</Chip>
    <Chip tone="primary">Meta verified</Chip>
    <Chip>No data yet</Chip>
  </div>
);
