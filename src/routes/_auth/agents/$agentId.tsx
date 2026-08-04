import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import SectionHeader from "@/components/SectionHeader";
import { useTranslation } from "@/hooks/useTranslation";
import {
  useAgent,
  useDeleteAgent,
  useUpdateAgent,
  useCurrentAgent,
} from "@/queries/useAgents";
import { useForm } from "react-hook-form";
import SectionBody from "@/components/SectionBody";
import useBoundStore from "@/stores/useBoundStore";
import { type AIAgentRow, type AIAgentUpdate } from "@/supabase/client";
import { startConversation, threadKey } from "@/utils/ConversationUtils";
import { useOrganizationsAddresses } from "@/queries/useOrganizationsAddresses";
import SectionFooter from "@/components/SectionFooter";
import Button from "@/components/Button";
import SelectField from "@/components/SelectField";
import TextAreaField from "@/components/TextAreaField";
import SectionField from "@/components/SectionField";
import PersonaSection from "@/components/PersonaSection";
import SkillsSection from "@/components/SkillsSection";
import SwitchField from "@/components/SwitchField";
import {
  DEFAULT_AGENT_MODEL,
  MODEL_OPTIONS,
  modelLabel,
} from "@/models/catalog";

export const Route = createFileRoute("/_auth/agents/$agentId")({
  component: AgentDetail,
});

function AgentDetail() {
  const { translate: t } = useTranslation();
  const navigate = useNavigate();
  const { agentId } = Route.useParams();
  const { data: agent } = useAgent<AIAgentRow>(agentId);
  const { data: currentAgent } = useCurrentAgent();
  const isAdmin = ["admin", "owner"].includes(currentAgent?.extra?.role || "");
  const deleteAgent = useDeleteAgent();
  const updateAgent = useUpdateAgent();
  const activeOrgId = useBoundStore((state) => state.ui.activeOrgId);

  const localAddress = useOrganizationsAddresses().data?.find(
    (address) => address.service === "local",
  );

  // Normalize agent data so the skills field array always has an array, and so
  // the scope guard reads as on for agents saved before it existed (the API
  // treats undefined as on too). Normalizing here also keeps it out of the
  // dirty check: `values` is the baseline the form compares against.
  const normalizedAgent = useMemo(() => {
    if (!agent) return undefined;
    return {
      ...agent,
      extra: {
        ...agent.extra,
        skills: agent.extra?.skills ?? [],
        on_topic_only: agent.extra?.on_topic_only ?? true,
      },
    };
  }, [agent]);

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { isDirty, isValid },
  } = useForm<AIAgentUpdate>({ values: normalizedAgent });

  const handleChat = () => {
    if (!activeOrgId || !localAddress) return;

    const conv = startConversation({
      organization_id: activeOrgId,
      organization_address: localAddress.address,
      service: "local",
      extra: { default_agent_id: agentId },
      name: agent?.name,
    });

    // Agent chats have no contact address, so their thread key is built from
    // the conversation id — see `threadKey`.
    navigate({ hash: threadKey(conv) });
  };

  return (
    agent && (
      <>
        <SectionHeader
          title={agent.name}
          onDelete={() => {
            deleteAgent.mutate(agentId, {
              onSuccess: () =>
                navigate({ to: "..", hash: (prevHash) => prevHash! }),
            });
          }}
          deleteDisabled={!isAdmin}
          deleteDisabledReason={t("Requires administrator permissions")}
          deleteLoading={deleteAgent.isPending}
        />

        <SectionBody>
          <form
            id="agent-form"
            onSubmit={handleSubmit((data) => updateAgent.mutate(data))}
          >
            <fieldset disabled={!isAdmin} className="contents">
              <label>
                <div className="label">{t("Name")}</div>
                <input
                  type="text"
                  className="text"
                  placeholder={t("Agent name")}
                  {...register("name", { required: true })}
                />
              </label>

              <SelectField
                name="extra.mode"
                control={control}
                label={t("Status")}
                options={[
                  { value: "active", label: t("Active") },
                  { value: "draft", label: t("Draft") },
                  { value: "inactive", label: t("Inactive") },
                ]}
              />

              <div className="border-t border-border" />

              <PersonaSection
                control={control}
                register={register}
                disabled={!isAdmin}
              />

              <SkillsSection
                control={control}
                register={register}
                setValue={setValue}
                disabled={!isAdmin}
              />

              <SwitchField
                name="extra.on_topic_only"
                control={control}
                label={t("Only reply when relevant")}
                description={t(
                  "Stay silent on small talk and anything outside the business's services and this agent's skills.",
                )}
                disabled={!isAdmin}
              />

              <p className="text-muted-foreground text-[14px]">
                {t("Business details are configured in")}{" "}
                <Link
                  to="/settings/organization"
                  className="underline"
                  hash={(prevHash) => prevHash!}
                >
                  {t("the organization settings")}
                </Link>
                .
              </p>

              <SectionField label={t("Advanced")}>
                <TextAreaField
                  name="extra.instructions"
                  control={control}
                  label={t("Additional instructions")}
                  placeholder={t("You are a helpful assistant...")}
                />
                <SelectField
                  name="extra.model"
                  control={control}
                  label={t("Model")}
                  options={MODEL_OPTIONS}
                  placeholder={modelLabel(DEFAULT_AGENT_MODEL)}
                />
              </SectionField>
            </fieldset>
          </form>
        </SectionBody>

        <SectionFooter>
          {!isDirty ? (
            <button type="button" className="primary" onClick={handleChat}>
              {t("Chat with this agent")}
            </button>
          ) : (
            <Button
              form="agent-form"
              type="submit"
              disabled={!isAdmin}
              invalid={!isValid}
              loading={updateAgent.isPending}
              disabledReason={t("Requires administrator permissions")}
              className="primary"
            >
              {t("Update")}
            </Button>
          )}
        </SectionFooter>
      </>
    )
  );
}
