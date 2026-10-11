import type { SignupPayload } from "@/contexts/WhatsAppIntegrationContext";

export type WaSessionInfo = Pick<
  SignupPayload,
  "phone_number_id" | "waba_id" | "business_id" | "flow_type"
>;

const FINISH_EVENT_TIMEOUT_MS = 5000;

let sessionInfo: WaSessionInfo | undefined;
const waiters = new Set<(info: WaSessionInfo) => void>();

// An abandoned flow emits no finish event, so a previous attempt's session info
// would otherwise be posted as this attempt's.
export function resetWaSessionInfo() {
  sessionInfo = undefined;
}

export function setWaSessionInfo(info: WaSessionInfo) {
  sessionInfo = info;
  waiters.forEach((resolve) => resolve(info));
}

// The FB.login callback can run before the WA_EMBEDDED_SIGNUP finish event
// arrives, and sometimes the event never arrives. Resolving empty after the
// timeout lets the server derive the WABA and number from the code instead.
export function waitForWaSessionInfo(
  timeoutMs = FINISH_EVENT_TIMEOUT_MS,
): Promise<WaSessionInfo> {
  if (sessionInfo) return Promise.resolve(sessionInfo);

  return new Promise((resolve) => {
    const done = (info: WaSessionInfo) => {
      clearTimeout(timer);
      waiters.delete(done);
      if (!info.waba_id) {
        console.warn("No Embedded Signup finish event; server will derive ids");
      }
      resolve(info);
    };
    const timer = setTimeout(() => done({}), timeoutMs);
    waiters.add(done);
  });
}
