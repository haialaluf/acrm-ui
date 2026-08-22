import { ReadMoreText } from "acrm-ui";

export const Short = () => (
  <div style={{ width: 320, padding: 16 }}>
    <ReadMoreText text="Hi {{1}}, your appointment is confirmed for Tuesday at 10:00." vars={["Dana"]} />
  </div>
);

export const Collapsed = () => (
  <div style={{ width: 320, padding: 16 }}>
    <ReadMoreText
      text={
        "Hi {{1}}, thanks for booking with us.\n\n" +
        "*What to bring*\nA photo ID and your booking reference. If someone else is coming in your place, let us know at least a day ahead so we can update the appointment.\n\n" +
        "*Getting here*\nWe're on the second floor, above the pharmacy. Street parking is free after 17:00, and there is a paid lot two minutes away.\n\n" +
        "*Need to change it?*\nReply to this message and we'll move it — no charge up to 24 hours before."
      }
      vars={["Dana"]}
    />
  </div>
);
