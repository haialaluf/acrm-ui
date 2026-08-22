import { Checkbox } from "acrm-ui";

export const Checked = () => (
  <div style={{ display: "flex", gap: 16, alignItems: "center", padding: 16 }}>
    <Checkbox checked onChange={() => {}} />
    <Checkbox checked={false} onChange={() => {}} />
  </div>
);

export const InARow = () => (
  <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: 16 }}>
    {[
      { name: "Dana Levi", on: true },
      { name: "Yossi Mizrahi", on: true },
      { name: "Noa Barak", on: false },
    ].map((c) => (
      <div key={c.name} style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <Checkbox checked={c.on} onChange={() => {}} />
        <span className="text-[14px]">{c.name}</span>
      </div>
    ))}
  </div>
);
