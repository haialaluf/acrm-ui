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
import { useForm, useWatch } from "react-hook-form";
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
import FaqSection from "@/components/FaqSection";
import SwitchField from "@/components/SwitchField";
import { MODEL_OPTIONS } from "@/models/catalog";

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

  // Normalize agent data so the skills and FAQ field arrays always have an
  // array, and so the scope guard reads as on for agents saved before it
  // existed (the API treats undefined as on too). Normalizing here also keeps
  // it out of the dirty check: `values` is the baseline the form compares
  // against.
  const normalizedAgent = useMemo(() => {
    if (!agent) return undefined;
    return {
      ...agent,
      extra: {
        ...agent.extra,
        skills: agent.extra?.skills ?? [],
        faq: agent.extra?.faq ?? [],
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

  const kind =
    useWatch({ control, name: "kind" }) ?? agent?.kind ?? "customer_facing";
  const isBackOffice = kind === "back_office";
  const isPersonalAssistant = kind === "personal_assistant";

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
          deleteDisabled={!isAdmin || isPersonalAssistant}
          deleteDisabledReason={
            isPersonalAssistant
              ? t("The personal assistant can't be deleted")
              : t("Requires administrator permissions")
          }
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

              {!isPersonalAssistant && (
                <SelectField
                  name="kind"
                  control={control}
                  label={t("Type")}
                  options={[
                    { value: "customer_facing", label: t("Customer facing") },
                    { value: "back_office", label: t("Back office") },
                  ]}
                />
              )}

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

              {!isBackOffice && !isPersonalAssistant && (
                <>
                  <PersonaSection control={control} disabled={!isAdmin} />

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
                </>
              )}

              <SectionField label={t("Advanced")}>
                <TextAreaField
                  name="extra.instructions"
                  control={control}
                  label={
                    isBackOffice
                      ? t("Analysis instructions")
                      : t("Additional instructions")
                  }
                  placeholder={
                    isBackOffice
                      ? t(
                          "Describe what this agent should look for and record…",
                        )
                      : t("You are a helpful assistant...")
                  }
                />
                {!isBackOffice && !isPersonalAssistant && (
                  <FaqSection
                    control={control}
                    register={register}
                    disabled={!isAdmin}
                    modalClassName="bottom-0"
                  />
                )}
                <SelectField
                  name="extra.model"
                  control={control}
                  label={t("Model")}
                  options={MODEL_OPTIONS}
                  placeholder={t("Default")}
                />
              </SectionField>
            </fieldset>
          </form>
        </SectionBody>

        <SectionFooter>
          {!isDirty ? (
            isBackOffice ? null : (
              <button type="button" className="primary" onClick={handleChat}>
                {t("Chat with this agent")}
              </button>
            )
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
