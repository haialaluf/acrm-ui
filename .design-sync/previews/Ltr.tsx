import { Ltr } from "acrm-ui";

export const NumbersInRtlText = () => (
  <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }} dir="rtl">
    <div className="text-[14px]">
      נשלחו <Ltr className="text-[14px]">1,248</Ltr> הודעות ב־<Ltr>+972 54-123-4567</Ltr>
    </div>
  </div>
);
