//===================================
// UI-only types — NOT present in open-bsp-api's _shared/types/*.
//
// This file is never overwritten when re-syncing the mirrored API type files,
// so put genuinely UI-exclusive additions here (not divergences — those are
// field-level edits that must stay inline in the mirrored file, tagged with
// `// @ui-divergence`). See scripts/check-type-sync.sh.
//===================================

// Narrowed insert/update shapes for the human-agent `extra` column, used by the
// members forms. The API has no insert/update variants of HumanAgentExtra.
export type HumanAgentExtraInsert = {
  role: "member" | "admin" | "owner";
  invitation?: {
    organization_name: string;
    email: string;
    status: "pending";
  };
};

export type HumanAgentExtraUpdate = {
  role?: "member" | "admin" | "owner";
  invitation?: {
    organization_name?: string;
    email?: string;
    status?: "pending" | "accepted" | "rejected";
  };
};

// ── Organization calendars (public.calendars) ──────────────────────────────
// The DB has no generated types for `calendars` yet, so the shapes below are
// UI-authored. `working_hours`/`extra` are opaque jsonb server-side; the
// meeting-scheduling agent reads `working_hours` back verbatim via the ACRM
// MCP `check_availability` tool, so keep this shape stable.

export type Weekday = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";

// One working interval, "HH:MM" 24h strings in the calendar's `timezone`.
export type WorkingHoursDay = { from: string; to: string };

// Per-weekday working hours. A missing day means the calendar is closed that
// day (the agent treats an absent/empty day as "business closed").
export type CalendarWorkingHours = Partial<Record<Weekday, WorkingHoursDay>>;

// public.calendars.extra — keeps the ISO 3166 country/region the calendar was
// created for. The column of record for scheduling is the IANA `timezone`
// (derived from this region); `region` is stored so the form can round-trip
// the human-facing country choice.
export type CalendarExtra = { region?: string };

// ── Appointments (public.appointments) ─────────────────────────────────────
// A booked meeting on a calendar. Like `calendars`, the DB has no generated
// types yet, so the shapes below are UI-authored (mirrored in
// database_types.ts). Mirrors public.appointment_status.
export type AppointmentStatus =
  | "scheduled"
  | "confirmed"
  | "cancelled"
  | "completed";

// public.appointments.extra — free-form JSON for future scheduling metadata
// (e.g. notes, video-call links). Kept opaque and stable for the agent.
export type AppointmentExtra = { notes?: string };
