/**
 * Typed wrapper over the public `booking` edge function.
 *
 * Covers the WHOLE endpoint contract, not just the one call this phase's page
 * makes — it is the seam the slot picker is written against next, so the
 * shapes are settled here while the backend is fresh.
 *
 * No supabase client: these routes take no key and no session. The token in
 * the path is the entire credential, so it is never logged or put in a query
 * string, and the page sends `Referrer-Policy: no-referrer`.
 */

const API_BASE = `${(import.meta.env.VITE_BOOKING_API_URL || "").replace(
  /\/+$/,
  "",
)}/booking`;

/** What the visitor may know about their own appointment. Nothing else on the
 *  calendar is ever exposed — not titles, not who booked, not busy times. */
export type BookingAppointment = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
};

export type BookingLinkContext = {
  valid: true;
  organization_name: string;
  calendar_name: string;
  /** IANA zone the slot instants are expressed in. */
  timezone: string;
  duration_minutes: number;
  /** First name only — the URL is shareable, so PII in it stays minimal. */
  contact_first_name: string | null;
  appointment: BookingAppointment | null;
};

/** An unknown, expired or revoked token — deliberately indistinguishable. */
export type InvalidLink = { valid: false };

export class BookingError extends Error {
  // Declared and assigned explicitly: `erasableSyntaxOnly` (tsconfig) rules
  // out constructor parameter properties, which emit real code.
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string) {
    super(code);
    this.name = "BookingError";
    this.status = status;
    this.code = code;
  }
}

async function request<T>(
  path: string,
  init?: Omit<RequestInit, "body"> & { body?: unknown },
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: init?.body ? { "content-type": "application/json" } : undefined,
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new BookingError(
      res.status,
      (data as { error?: string } | null)?.error ?? "request_failed",
    );
  }
  return data as T;
}

/**
 * Link context. A bad token resolves to `{ valid: false }` rather than
 * throwing, because "this link no longer works" is a page state, not an error.
 */
export async function getLink(
  token: string,
): Promise<BookingLinkContext | InvalidLink> {
  try {
    return await request<BookingLinkContext>(`/${token}`);
  } catch (e) {
    if (e instanceof BookingError && e.status === 404) return { valid: false };
    throw e;
  }
}

/** Free start instants (ISO, with the calendar's offset) — free ones only. */
export async function getSlots(
  token: string,
  range: { from?: Date; to?: Date } = {},
): Promise<string[]> {
  const params = new URLSearchParams();
  if (range.from) params.set("from", range.from.toISOString());
  if (range.to) params.set("to", range.to.toISOString());
  const query = params.toString();

  const { slots } = await request<{ slots: string[] }>(
    `/${token}/slots${query ? `?${query}` : ""}`,
  );
  return slots;
}

/** Book a free start. Throws `slot_taken` if someone else got there first. */
export async function createAppointment(
  token: string,
  startsAt: string,
): Promise<BookingAppointment> {
  const { appointment } = await request<{ appointment: BookingAppointment }>(
    `/${token}/appointments`,
    { method: "POST", body: { starts_at: startsAt } },
  );
  return appointment;
}

export async function rescheduleAppointment(
  token: string,
  id: string,
  startsAt: string,
): Promise<BookingAppointment> {
  const { appointment } = await request<{ appointment: BookingAppointment }>(
    `/${token}/appointments/${id}`,
    { method: "PATCH", body: { starts_at: startsAt } },
  );
  return appointment;
}

export async function cancelAppointment(
  token: string,
  id: string,
): Promise<BookingAppointment> {
  const { appointment } = await request<{ appointment: BookingAppointment }>(
    `/${token}/appointments/${id}`,
    { method: "DELETE" },
  );
  return appointment;
}
