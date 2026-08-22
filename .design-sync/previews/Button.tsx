import { Button } from "acrm-ui";

export const Primary = () => (
  <div style={{ display: "flex", gap: 12, alignItems: "center", padding: 16 }}>
    <Button className="primary px-[24px]">Send broadcast</Button>
    <Button className="destructive px-[24px]">Cancel batch</Button>
  </div>
);

export const States = () => (
  <div style={{ display: "flex", gap: 12, alignItems: "center", padding: 16 }}>
    <Button className="primary px-[24px]" loading>Sending</Button>
    <Button className="primary px-[24px]" disabled disabledReason="Pick a template first">
      Disabled
    </Button>
    <Button className="primary px-[24px]" invalid>Invalid</Button>
  </div>
);
