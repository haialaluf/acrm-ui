import { SectionField } from "acrm-ui";

export const Triggers = () => (
  <div style={{ position: "relative", width: 420, padding: 20, display: "flex", flexDirection: "column", gap: 24 }}>
    <SectionField label="Working hours" description="Sun–Thu, 09:00–18:00">
      <div />
    </SectionField>
    <SectionField label="Auto-reply" description="Off">
      <div />
    </SectionField>
    <SectionField label="Assigned agent" description="Not available on this plan" disabled>
      <div />
    </SectionField>
  </div>
);
