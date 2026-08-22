import { StatsPanel, QuotaBar } from "acrm-ui";

export const WithContent = () => (
  <div style={{ width: 640 }}>
    <StatsPanel title="Usage this month">
      <QuotaBar
        productName="Messages"
        kind="quota"
        unit="messages"
        interval="month"
        used={1240}
        included={2000}
        cap={2000}
      />
      <QuotaBar
        productName="AI Credits"
        kind="balance"
        unit="credits"
        interval="month"
        used={318}
        included={null}
        granted={1000}
        cap={1000}
      />
    </StatsPanel>
  </div>
);
