import SectionBody from "@/components/SectionBody";
import SectionHeader from "@/components/SectionHeader";
import SectionFooter from "@/components/SectionFooter";
import { useTranslation } from "@/hooks/useTranslation";
import {
  useCurrentOrganization,
  useUpdateCurrentOrganization,
  useDeleteCurrentOrganization,
} from "@/queries/useOrganizations";
import { useCurrentAgent, useCurrentAgents } from "@/queries/useAgents";
import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useMemo } from "react";
import useBoundStore from "@/stores/useBoundStore";
import { LANGUAGE_LABELS, SUPPORTED_LANGUAGES } from "@/stores/uiSlice";
import Button from "@/components/Button";
import SelectField from "@/components/SelectField";
import Switch from "@/components/Switch";
import TextAreaField from "@/components/TextAreaField";
import SectionField from "@/components/SectionField";
import WorkingHoursField from "@/components/WorkingHoursField";
import CountryField, { useDetectedRegion } from "@/components/CountryField";
import {
  expandClosedDays,
  hasWorkingHoursIssues,
  resolveTimezone,
} from "@/utils/calendar";
import { NO_DEFAULT_AGENT, type OrganizationUpdate } from "@/supabase/client";

export const Route = createFileRoute("/_auth/settings/organization/")({
  beforeLoad: () => {
    const activeOrgId = useBoundStore.getState().ui.activeOrgId;
    if (!activeOrgId) {
      throw redirect({
        to: "/settings/organization/new",
      });
    }
  },
  component: EditOrganization,
});

function EditOrganization() {
  const { translate: t } = useTranslation();
  const navigate = useNavigate();
  const { data: org } = useCurrentOrganization();
  const { data: agent } = useCurrentAgent();
  const { data: agents } = useCurrentAgents();
  const isOwner = agent?.extra?.role === "owner";

  // Back-office and personal-assistant agents are excluded: this picker is
  // who answers a contact by default, which neither kind can ever do
  // (agent-client never lets either into that fallback — see its AGENT
  // SELECTION block).
  const aiAgents = (agents ?? []).filter(
    (a) => a.ai && a.kind !== "back_office" && a.kind !== "personal_assistant",
  );
  const setActiveOrg = useBoundStore((state) => state.ui.setActiveOrg);
  const updateOrg = useUpdateCurrentOrganization();
  const deleteOrg = useDeleteCurrentOrganization();

  const detected = useDetectedRegion();
  // Whether the country was already a saved choice, which is what retires the
  // "detected from browser" badge — the organization's answer to CalendarForm's
  // `isEdit`, since the organization itself always exists but this field is new
  // and unset on every organization that predates it.
  const savedRegion = !!org?.extra?.business_profile?.region;

  const normalizedOrg = useMemo(() => {
    if (!org) return undefined;
    return {
      ...org,
      extra: {
        ...org.extra,
        error_messages_direction:
          org.extra?.error_messages_direction || "internal",
        transcription: {
          mode: "inactive" as const,
          ...org.extra?.transcription,
        },
        business_profile: {
          ...org.extra?.business_profile,
          // Seeded from the browser exactly as CalendarForm seeds a new
          // calendar's. It is the form's baseline, so it does not by itself
          // make the form dirty — nothing is written until the owner saves.
          region: org.extra?.business_profile?.region ?? detected.region,
        },
      },
    };
  }, [org, detected.region]);

  const {
    register,
    handleSubmit,
    control,
    formState: { isValid, isDirty },
  } = useForm<OrganizationUpdate>({ values: normalizedOrg });

  const defaultAgentId = useWatch({ control, name: "extra.default_agent_id" });

  const transcriptionMode = useWatch({
    control,
    name: "extra.transcription.mode",
  });

  // Overlapping or backwards windows would render to the agent as nonsense
  // ("Sunday: 17:00-09:00"), and RHF's own `isValid` can't see inside a
  // Controller-held object — so gate the save the way CalendarForm does.
  const workingHours = useWatch({
    control,
    name: "extra.business_profile.working_hours",
  });
  const hoursInvalid = !!workingHours && hasWorkingHoursIssues(workingHours);

  return (
    <>
      <SectionHeader
        title={t("Edit organization")}
        onDelete={() =>
          deleteOrg.mutate(undefined, {
            onSuccess: () => {
              setActiveOrg(null);
              navigate({ to: "/conversations" });
            },
          })
        }
        deleteDisabled={!isOwner}
        deleteDisabledReason={t("Requires owner permissions")}
        deleteLoading={deleteOrg.isPending}
      />

      <SectionBody>
        <form
          id="org-form"
          onSubmit={handleSubmit((data) => {
            const profile = data.extra?.business_profile;
            const hours = profile?.working_hours;
            updateOrg.mutate({
              ...data,
              address: data.address?.trim(),
              ...((hours || profile?.region) && {
                extra: {
                  ...data.extra,
                  business_profile: {
                    ...profile,
                    // A day switched off leaves the object entirely, and
                    // `organizations.extra` is deep-merged by the
                    // `merge_update` trigger — which never removes a key.
                    // Without this, closing a day would save nothing and the
                    // agent would keep quoting the old hours.
                    // `expandClosedDays` sends `[]` instead.
                    ...(hours && { working_hours: expandClosedDays(hours) }),
                    // The picker stores a country; everything downstream reads
                    // an IANA id. Derived here rather than kept in the form so
                    // the two can never drift out of step, exactly as
                    // CalendarForm derives `calendars.timezone`.
                    ...(profile?.region && {
                      timezone: resolveTimezone(profile.region, detected),
                    }),
                  },
                },
              }),
            });
          })}
        >
          <label>
            <div className="label">{t("Name")}</div>
            <input
              className="text"
              placeholder={t("Organization name")}
              disabled={!isOwner}
              {...register("name", { required: true })}
            />
          </label>
          <label>
            <div className="label">{t("Address")}</div>
            <textarea
              className="text"
              rows={3}
              placeholder={t("Street, city, postal code, country")}
              disabled={!isOwner}
              {...register("address", {
                required: true,
                validate: (value) => (value ?? "").trim().length > 0,
              })}
            />
          </label>

          <label>
            <div className="label">{t("Response delay (seconds)")}</div>
            <input
              type="number"
              className="text"
              placeholder="3"
              disabled={!isOwner}
              {...register("extra.response_delay_seconds", {
                valueAsNumber: true,
              })}
            />
          </label>

          <TextAreaField
            control={control}
            name="extra.welcome_message"
            label={t("Welcome message")}
            placeholder={t("Hello! I'm a virtual agent. How can I help you?")}
            disabled={!isOwner}
          />

          <SelectField
            control={control}
            name="extra.error_messages_direction"
            label={t("Error messages")}
            options={[
              { value: "internal", label: t("UI only") },
              { value: "outgoing", label: t("Visible from WhatsApp") },
            ]}
            disabled={!isOwner}
          />

          {aiAgents.length > 0 && (
            <div className="flex flex-col gap-[8px]">
              <SelectField
                control={control}
                name="extra.default_agent_id"
                label={t("Default agent")}
                placeholder={t("Oldest active agent")}
                options={[
                  { value: NO_DEFAULT_AGENT, label: t("None") },
                  ...aiAgents.map((a) => ({ value: a.id, label: a.name })),
                ]}
                disabled={!isOwner}
              />
              {defaultAgentId === NO_DEFAULT_AGENT && (
                <p className="text-[12px] text-muted-foreground">
                  {t(
                    "No agent replies automatically. Every conversation waits for a person.",
                  )}
                </p>
              )}
            </div>
          )}

          <div className="border-t border-border" />

          {/* Company-wide facts, shared by all this organization's agents. */}
          <SectionField
            label={t("Business profile")}
            description={t("Shared by all agents")}
            disabled={!isOwner}
          >
            <label>
              <div className="label">{t("Business name")}</div>
              <input
                className="text"
                placeholder={org?.name}
                disabled={!isOwner}
                {...register("extra.business_profile.business_name")}
              />
            </label>

            <TextAreaField
              control={control}
              name="extra.business_profile.description"
              label={t("Description")}
              placeholder={t("What does the business do?")}
              disabled={!isOwner}
            />

            <TextAreaField
              control={control}
              name="extra.business_profile.services"
              label={t("Services")}
              placeholder={t("Haircut 30min $20\nColor 60min $50 ...")}
              disabled={!isOwner}
            />

            {/* Named to the client when the agent hands a conversation over.
                Left blank the agent says "someone will get back to you" — the
                honest default for a rota or a shared inbox. */}
            <label>
              <div className="label">{t("Who follows up")}</div>
              <input
                className="text"
                placeholder={t("Leave blank if it varies")}
                disabled={!isOwner}
                {...register("extra.business_profile.contact_name")}
              />
              <div className="text-muted-foreground text-[14px] mt-[4px]">
                {t(
                  "The agent names this person when it hands a conversation to a human. Set it only if the same person always replies.",
                )}
              </div>
            </label>

            {/* Which clock the hours below are kept on — the calendar
                editor's picker, unchanged. */}
            <Controller
              control={control}
              name="extra.business_profile.region"
              render={({ field }) => (
                <CountryField
                  value={field.value ?? detected.region}
                  onChange={field.onChange}
                  detected={detected}
                  saved={savedRegion}
                  disabled={!isOwner}
                />
              )}
            />

            {/* When the business is OPEN — not when it takes appointments.
                Booking hours stay on each calendar; these only exist so the
                agent can answer "are you open on Saturday?" from the prompt
                instead of coming back to the client with it. */}
            <Controller
              control={control}
              name="extra.business_profile.working_hours"
              render={({ field }) => (
                <WorkingHoursField
                  value={field.value ?? {}}
                  onChange={field.onChange}
                  disabled={!isOwner}
                  label={t("Opening hours")}
                  description={t(
                    "The days and hours the business is open. The agent quotes these to clients; appointment availability is set per calendar.",
                  )}
                />
              )}
            />
          </SectionField>

          {/* Machine-reads the files clients send — voice notes, photos,
              documents — so the agent has their contents as text. Its own
              section rather than two loose fields, because the language only
              means anything while the switch is on. */}
          <SectionField
            label={t("Transcription")}
            description={t("Reads voice messages, images and documents")}
            disabled={!isOwner}
          >
            <Controller
              control={control}
              name="extra.transcription.mode"
              render={({ field }) => (
                <label className="flex items-center gap-[12px] cursor-pointer justify-between">
                  <div className="flex flex-col gap-[2px]">
                    <div className="text-foreground">{t("Status")}</div>
                    <div className="text-muted-foreground text-[14px]">
                      {t(
                        "Voice messages are transcribed, and images and documents described, before the agent replies.",
                      )}
                    </div>
                  </div>
                  <Switch
                    checked={field.value === "active"}
                    onCheckedChange={(checked) =>
                      field.onChange(checked ? "active" : "inactive")
                    }
                    disabled={!isOwner}
                    className="mt-[4px]"
                  />
                </label>
              )}
            />

            {/* Only offered while transcription is on — the hint is dead
                config otherwise, and a set-but-inert field reads as a bug. */}
            {transcriptionMode === "active" && (
              <div className="flex flex-col gap-[8px]">
                <SelectField
                  control={control}
                  name="extra.transcription.language"
                  label={t("Primary language")}
                  placeholder={t("Detect automatically")}
                  options={[
                    // An explicit way back to auto-detect. Empty string rather
                    // than a sentinel: the API treats any falsy `language` as
                    // "no hint", and `organizations.extra` is deep-merged by
                    // the `merge_update` trigger, so clearing the field has to
                    // write something rather than drop the key.
                    { value: "", label: t("Detect automatically") },
                    ...SUPPORTED_LANGUAGES.map((lang) => ({
                      value: lang,
                      label: LANGUAGE_LABELS[lang],
                    })),
                  ]}
                  disabled={!isOwner}
                />
                <p className="text-[12px] text-muted-foreground">
                  {t(
                    "The language your clients speak. English is always understood too, so a voice message in either is transcribed correctly. Leave unset to detect the language every time.",
                  )}
                </p>
              </div>
            )}
          </SectionField>
        </form>
      </SectionBody>

      <SectionFooter>
        <Button
          form="org-form"
          type="submit"
          disabled={!isOwner}
          invalid={!isValid || !isDirty || hoursInvalid}
          loading={updateOrg.isPending}
          disabledReason={t("Requires owner permissions")}
          className="primary"
        >
          {t("Update")}
        </Button>
      </SectionFooter>
    </>
  );
}
