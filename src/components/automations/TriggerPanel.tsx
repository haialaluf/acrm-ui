import { X } from "lucide-react";
import type {
  AutomationEventName,
  AutomationTrigger,
  TimeUnit,
  WeekDay,
} from "@/supabase/client";
import { WEEK_DAYS } from "@/supabase/types/automation_types";
import { useTranslation } from "@/hooks/useTranslation";
import { useContactTags } from "@/queries/useContactTags";
import { useContactSourceOptions } from "@/queries/useContactSources";
import { useCalendars } from "@/queries/useCalendars";
import {
  Callout,
  CheckList,
  Divider,
  Field,
  inputBase,
  inputClass,
  Segmented,
  selectClass,
} from "./Fields";

/**
 * Trigger configuration: the three kinds, and what each needs.
 *
 * Two things differ from the design here, both because the mock's model does
 * not exist in this database:
 *
 *   - Tags and sources are picked by NAME, not by id. `contacts.tags` is a
 *     text[] with no tag entity behind it, and `contacts.source` is free text,
 *     so the vocabulary is whatever the org has actually used.
 *   - The `contact_field` date anchor gains a field input. The mock offers the
 *     anchor with nowhere to say which date, which the scanner cannot act on.
 */

const TIME_ZONES = [
  "Asia/Jerusalem",
  "Europe/London",
  "Europe/Madrid",
  "America/New_York",
  "America/Sao_Paulo",
];

export default function TriggerPanel({
  trigger,
  onChange,
}: {
  trigger: AutomationTrigger;
  onChange: (trigger: AutomationTrigger) => void;
}) {
  const { translate: t } = useTranslation();
  const { data: tags } = useContactTags();
  const { data: sources } = useContactSourceOptions();
  const { data: calendars } = useCalendars();

  const asOptions = (values: string[]) =>
    values.map((value) => ({ id: value, name: value }));

  return (
    <>
      <Field
        label={t("Trigger type")}
        hint={t(
          "Decides when contacts enter this flow. Changing it clears the trigger's own settings — your steps stay.",
        )}
      >
        <Segmented
          value={trigger.kind}
          onChange={(kind) => {
            if (kind === trigger.kind) return;
            // A fresh trigger of the new kind, rather than a merge: carrying
            // `sources` into a schedule trigger would leave a field nothing
            // reads and the user cannot see.
            onChange(
              kind === "event"
                ? { kind: "event", event: "lead_created", sources: [] }
                : kind === "date"
                  ? {
                      kind: "date",
                      anchor: "appointment_start",
                      offsetAmount: 1,
                      offsetUnit: "days",
                      offsetDir: "before",
                      calendarIds: [],
                    }
                  : {
                      kind: "schedule",
                      times: ["09:00"],
                      days: ["Sun", "Mon", "Tue", "Wed", "Thu"],
                      tz: "Asia/Jerusalem",
                    },
            );
          }}
          options={[
            { value: "event", label: t("Event") },
            { value: "date", label: t("Before a date") },
            { value: "schedule", label: t("Schedule") },
          ]}
        />
      </Field>

      {trigger.kind === "event" && (
        <>
          <Field label={t("Event")}>
            <select
              className={selectClass}
              value={trigger.event}
              onChange={(e) =>
                onChange({
                  ...trigger,
                  event: e.target.value as AutomationEventName,
                })
              }
            >
              <option value="lead_created">{t("New lead created")}</option>
              <option value="conversation_started">
                {t("Conversation started")}
              </option>
              <option value="tag_added">{t("Tag added to contact")}</option>
              <option value="appointment_booked">{t("Meeting booked")}</option>
            </select>
          </Field>

          {trigger.event === "tag_added" ? (
            <Field
              label={t("Tags")}
              hint={t("Leave all unchecked to accept every tag.")}
            >
              <CheckList
                items={asOptions(tags ?? [])}
                value={trigger.tags ?? []}
                onChange={(tagNames) =>
                  onChange({ ...trigger, tags: tagNames })
                }
                empty={t("No tags on your contacts yet.")}
              />
            </Field>
          ) : (
            <Field
              label={t("Only from these sources")}
              hint={t("Leave all unchecked to accept every source.")}
            >
              <CheckList
                items={sources ?? []}
                value={trigger.sources ?? []}
                onChange={(next) => onChange({ ...trigger, sources: next })}
              />
            </Field>
          )}

          <Field label={t("Re-entry")}>
            <label className="flex cursor-pointer items-center gap-[9px] text-[13px]">
              <input
                type="checkbox"
                className="m-0 h-[15px] w-[15px] accent-primary"
                checked={!!trigger.reentry}
                onChange={(e) =>
                  onChange({ ...trigger, reentry: e.target.checked })
                }
              />
              <span>{t("Let a contact enter more than once")}</span>
            </label>
          </Field>
        </>
      )}

      {trigger.kind === "date" && (
        <>
          <Field label={t("Relative to")}>
            <select
              className={selectClass}
              value={trigger.anchor}
              onChange={(e) =>
                onChange({
                  ...trigger,
                  anchor: e.target.value as typeof trigger.anchor,
                })
              }
            >
              <option value="appointment_start">
                {t("Scheduled meeting — start time")}
              </option>
              <option value="appointment_end">
                {t("Scheduled meeting — end time")}
              </option>
              <option value="contact_field">
                {t("A date field on the contact")}
              </option>
            </select>
          </Field>

          <Field label={t("Offset")}>
            <div
              className="grid gap-[9px]"
              style={{ gridTemplateColumns: "72px 1fr 1fr" }}
            >
              <input
                className={inputClass}
                type="number"
                min={0}
                value={trigger.offsetAmount}
                onChange={(e) =>
                  onChange({ ...trigger, offsetAmount: Number(e.target.value) })
                }
              />
              <select
                className={selectClass}
                value={trigger.offsetUnit}
                onChange={(e) =>
                  onChange({
                    ...trigger,
                    offsetUnit: e.target.value as TimeUnit,
                  })
                }
              >
                <option value="minutes">{t("minutes")}</option>
                <option value="hours">{t("hours")}</option>
                <option value="days">{t("days")}</option>
              </select>
              <select
                className={selectClass}
                value={trigger.offsetDir}
                onChange={(e) =>
                  onChange({
                    ...trigger,
                    offsetDir: e.target.value as "before" | "after",
                  })
                }
              >
                <option value="before">{t("before")}</option>
                <option value="after">{t("after")}</option>
              </select>
            </div>
          </Field>

          {trigger.anchor === "contact_field" ? (
            <Field
              label={t("Date field")}
              hint={t(
                "A path inside the contact's extra data, e.g. renewal_date. Only ISO-formatted dates are read.",
              )}
            >
              <input
                className={inputClass + " font-mono text-xs"}
                value={trigger.field ?? ""}
                placeholder="renewal_date"
                onChange={(e) =>
                  onChange({ ...trigger, field: e.target.value })
                }
              />
            </Field>
          ) : (
            <Field
              label={t("Calendars")}
              hint={t("Only meetings on these calendars fire the flow.")}
            >
              <CheckList
                items={(calendars ?? []).map((c) => ({
                  id: c.id,
                  name: c.name,
                }))}
                value={trigger.calendarIds ?? []}
                onChange={(next) => onChange({ ...trigger, calendarIds: next })}
                empty={t("No calendars yet.")}
              />
            </Field>
          )}
        </>
      )}

      {trigger.kind === "schedule" && (
        <>
          <Field
            label={t("Run at")}
            hint={t(
              "At each of these times the flow picks up every open conversation.",
            )}
          >
            <div className="flex flex-wrap items-center gap-[6px] py-1">
              {(trigger.times ?? []).map((time, index) => (
                <span
                  key={`${time}-${index}`}
                  className="inline-flex items-center gap-[5px] rounded-md bg-secondary px-[7px] py-[2px] text-xs text-secondary-foreground"
                >
                  {time}
                  <button
                    type="button"
                    aria-label={t("Remove time")}
                    className="flex p-0 text-inherit"
                    onClick={() =>
                      onChange({
                        ...trigger,
                        times: trigger.times.filter((_, i) => i !== index),
                      })
                    }
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <input
                className={inputBase + " w-[118px] px-2 py-1"}
                type="time"
                onChange={(e) => {
                  if (!e.target.value) return;
                  if (trigger.times?.includes(e.target.value)) return;
                  onChange({
                    ...trigger,
                    times: [...(trigger.times ?? []), e.target.value].sort(),
                  });
                }}
              />
            </div>
          </Field>

          <Field label={t("Days")}>
            <div className="flex gap-[5px]">
              {WEEK_DAYS.map((day: WeekDay) => {
                const on = (trigger.days ?? []).includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    className={
                      "flex-1 rounded-lg border px-0 py-[6px] text-[12.5px] " +
                      (on
                        ? "border-primary bg-primary text-white"
                        : "border-border bg-card text-muted-foreground")
                    }
                    onClick={() =>
                      onChange({
                        ...trigger,
                        days: on
                          ? trigger.days.filter((d) => d !== day)
                          : [...(trigger.days ?? []), day],
                      })
                    }
                  >
                    {t(day).slice(0, 1)}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label={t("Time zone")}>
            <select
              className={selectClass}
              value={trigger.tz}
              onChange={(e) => onChange({ ...trigger, tz: e.target.value })}
            >
              {TIME_ZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </Field>

          <Divider />

          <Callout>
            <span>
              {t(
                "The sweep picks up every open conversation. To narrow it, make the first step a Filter — it can match on tags, the 24-hour window, or anything else, and it shows on the canvas.",
              )}
            </span>
          </Callout>
        </>
      )}
    </>
  );
}
