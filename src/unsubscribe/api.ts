/**
 * Typed wrapper over the public `unsubscribe` edge function.
 *
 * No supabase client: these routes take no key and no session. The token in the
 * path is the entire credential, so it is never logged or put in a query
 * string, and the page sends `Referrer-Policy: no-referrer`.
 *
 * Note what is missing: there is no `getContext`-with-side-effects and no
 * "unsubscribe on load". Mail security scanners fetch every URL in a delivered
 * message before a human sees it, so opting out is only ever a POST the visitor
 * asks for. See the header comment in the edge function.
 */

const API_BASE = `${(import.meta.env.VITE_UNSUBSCRIBE_API_URL || "").replace(
  /\/+$/,
  "",
)}/unsubscribe`;

export type UnsubscribeContext = {
  valid: true;
  organization_name: string;
  /** Masked (`d•••@example.com`) — enough to recognise, not enough to harvest. */
  masked_address: string;
  status: "subscribed" | "unsubscribed";
  /** Whether the undo window is still open. Re-checked server-side. */
  can_undo: boolean;
};

/** An unknown, revoked or expired token — deliberately indistinguishable. */
export type InvalidLink = { valid: false };

export class UnsubscribeError extends Error {
  // Declared and assigned explicitly: `erasableSyntaxOnly` (tsconfig) rules out
  // constructor parameter properties, which emit real code.
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string) {
    super(code);
    this.name = "UnsubscribeError";
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, method: "GET" | "POST"): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { method });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new UnsubscribeError(
      res.status,
      (data as { error?: string } | null)?.error ?? "request_failed",
    );
  }
  return data as T;
}

/**
 * Link context. A bad token resolves to `{ valid: false }` rather than throwing,
 * because "this link no longer works" is a page state, not an error.
 */
export async function getContext(
  token: string,
): Promise<UnsubscribeContext | InvalidLink> {
  try {
    return await request<UnsubscribeContext>(`/${token}`, "GET");
  } catch (e) {
    if (e instanceof UnsubscribeError && e.status === 404) {
      return { valid: false };
    }
    throw e;
  }
}

/** Opt out. Idempotent — unsubscribing twice is a success. */
export function unsubscribe(token: string): Promise<UnsubscribeContext> {
  return request<UnsubscribeContext>(`/${token}`, "POST");
}

/**
 * Undo a misclick. Throws `undo_unavailable` (409) once the window has closed
 * or if this link did not perform the opt-out it is being asked to reverse.
 */
export function resubscribe(token: string): Promise<UnsubscribeContext> {
  return request<UnsubscribeContext>(`/${token}/resubscribe`, "POST");
}
