import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import SectionHeader from "@/components/SectionHeader";
import SectionFooter from "@/components/SectionFooter";
import { useTranslation } from "@/hooks/useTranslation";
import { useCreateAgent, useCurrentAgent } from "@/queries/useAgents";
import { useForm } from "react-hook-form";
import SectionBody from "@/components/SectionBody";
import { type AIAgentInsert } from "@/supabase/client";
import Button from "@/components/Button";
import SelectField from "@/components/SelectField";
import TextAreaField from "@/components/TextAreaField";
import SectionField from "@/components/SectionField";
import PersonaSection from "@/components/PersonaSection";
import SkillsSection from "@/components/SkillsSection";
import FaqSection from "@/components/FaqSection";
import SwitchField from "@/components/SwitchField";
import {
  DEFAULT_AGENT_MODEL,
  MODEL_OPTIONS,
  modelLabel,
} from "@/models/catalog";

export const Route = createFileRoute("/_auth/agents/new")({
  component: AddAgent,
});

function AddAgent() {
  const { translate: t } = useTranslation();
  const navigate = useNavigate();
  const createAgent = useCreateAgent();
  const { data: currentAgent } = useCurrentAgent();
  const isAdmin = ["admin", "owner"].includes(currentAgent?.extra?.role || "");

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { isValid, isDirty },
  } = useForm<AIAgentInsert>({
    // `api_url` is deliberately unset: the API derives the provider from the
    // model (see _shared/models.ts), and setting it here would pin the agent to
    // one provider and override that derivation.
    defaultValues: {
      extra: {
        mode: "active",
        protocol: "chat_completions",
        model: DEFAULT_AGENT_MODEL,
        skills: [],
        faq: [],
        on_topic_only: true,
      },
    },
  });

  const onSubmit = (data: AIAgentInsert) => {
    createAgent.mutate(
      { ...data, ai: true },
      {
        onSuccess: (agent) =>
          navigate({
            to: `/agents/${agent.id}`,
            hash: (prevHash: string | undefined) => prevHash!,
          }),
      },
    );
  };

  return (
    <>
      <SectionHeader title={t("Add agent")} />

      <SectionBody>
        <form id="create-agent-form" onSubmit={handleSubmit(onSubmit)}>
          <fieldset disabled={!isAdmin} className="contents">
            <p>
              {t(
                "Set up an AI agent that will automatically respond to your conversations.",
              )}
            </p>

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

            <PersonaSection control={control} />

            <SkillsSection
              control={control}
              register={register}
              setValue={setValue}
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
              <FaqSection
                control={control}
                register={register}
                disabled={!isAdmin}
                modalClassName="bottom-0"
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
        <Button
          form="create-agent-form"
          type="submit"
          disabled={!isAdmin}
          invalid={!isValid || !isDirty}
          loading={createAgent.isPending}
          disabledReason={t("Requires administrator permissions")}
          className="primary"
        >
          {t("Create")}
        </Button>
      </SectionFooter>
    </>
  );
}
