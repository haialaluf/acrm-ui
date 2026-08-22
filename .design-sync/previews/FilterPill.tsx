import { FilterPill } from "acrm-ui";

export const Row = () => (
  <div style={{ display: "flex", gap: 8, padding: 16 }}>
    <FilterPill label="7 days" active onClick={() => {}} />
    <FilterPill label="30 days" active={false} onClick={() => {}} />
    <FilterPill label="90 days" active={false} onClick={() => {}} />
  </div>
);
