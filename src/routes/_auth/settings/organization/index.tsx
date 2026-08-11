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
import { useForm, useWatch } from "react-hook-form";
import { useMemo } from "react";
import useBoundStore from "@/stores/useBoundStore";
import Button from "@/components/Button";
import SelectField from "@/components/SelectField";
import TextAreaField from "@/components/TextAreaField";
import SectionField from "@/components/SectionField";
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

  const normalizedOrg = useMemo(() => {
    if (!org) return undefined;
    return {
      ...org,
      extra: {
        ...org.extra,
        error_messages_direction:
          org.extra?.error_messages_direction || "internal",
      },
    };
  }, [org]);

  const {
    register,
    handleSubmit,
    control,
    formState: { isValid, isDirty },
  } = useForm<OrganizationUpdate>({ values: normalizedOrg });

  const defaultAgentId = useWatch({ control, name: "extra.default_agent_id" });

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
          onSubmit={handleSubmit((data) =>
            updateOrg.mutate({ ...data, address: data.address?.trim() }),
          )}
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
          </SectionField>
        </form>
      </SectionBody>

      <SectionFooter>
        <Button
          form="org-form"
          type="submit"
          disabled={!isOwner}
          invalid={!isValid || !isDirty}
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
