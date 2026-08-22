import { SegmentBtn } from "acrm-ui";

export const Segmented = () => (
  <div style={{ padding: 16 }}>
    <div
      style={{
        display: "inline-flex",
        gap: 2,
        padding: 3,
        borderRadius: 999,
        background: "var(--muted)",
      }}
    >
      <SegmentBtn active onClick={() => {}}>Fixed value</SegmentBtn>
      <SegmentBtn active={false} onClick={() => {}}>Per recipient</SegmentBtn>
    </div>
  </div>
);
