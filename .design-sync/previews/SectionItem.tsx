import { SectionItem, Avatar, StatusBadge } from "acrm-ui";

const avatar = (initials: string) => (
  <Avatar
    fallback={initials}
    size={49}
    className="bg-accent text-accent-foreground border border-border text-[16px]"
  />
);

export const Default = () => (
  <div style={{ width: 420, padding: 12 }}>
    <SectionItem
      title="Dana Levi"
      description="Thanks, see you Tuesday"
      aside={avatar("DL")}
      onClick={() => {}}
    />
  </div>
);

export const SelectedAndDisabled = () => (
  <div style={{ width: 420, padding: 12, display: "flex", flexDirection: "column", gap: 4 }}>
    <SectionItem
      title="Yossi Mizrahi"
      description="Can we move the meeting?"
      aside={avatar("YM")}
      actions={<StatusBadge label="sending" tone="primary" />}
      selected
      onClick={() => {}}
    />
    <SectionItem
      title="Noa Barak"
      description="Opted out of marketing messages"
      aside={avatar("NB")}
      disabled
      disabledReason="This contact unsubscribed"
    />
  </div>
);
