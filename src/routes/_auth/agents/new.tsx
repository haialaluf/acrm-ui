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
    // Provider/model are platform-managed (no client UI). Seed sensible
    // defaults so the runtime works; the platform can tune per-agent via a
    // direct jsonb edit.
    defaultValues: {
      extra: {
        mode: "active",
        api_url: "groq",
        protocol: "chat_completions",
        model: "openai/gpt-oss-20b",
        skills: [],
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

            <PersonaSection control={control} register={register} />

            <SkillsSection
              control={control}
              register={register}
              setValue={setValue}
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
