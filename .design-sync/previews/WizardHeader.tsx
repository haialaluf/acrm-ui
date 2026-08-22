import { WizardHeader } from "acrm-ui";

export const WithProgress = () => (
  <div style={{ width: 420 }}>
    <WizardHeader
      title="Choose recipients"
      subtitle="248 contacts match this filter"
      onBack={() => {}}
      step={2}
      showProgress
    />
  </div>
);

export const TerminalStage = () => (
  <div style={{ width: 420 }}>
    <WizardHeader title="Sending" subtitle="34 of 248 sent" showProgress={false} />
  </div>
);
