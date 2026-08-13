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
import Button from "@/components/Button";
import SelectField from "@/components/SelectField";
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

  const aiAgents = (agents ?? []).filter((a) => a.ai);
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
