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
import { startConversation } from "@/utils/ConversationUtils";
import { useOrganizationsAddresses } from "@/queries/useOrganizationsAddresses";
import SectionFooter from "@/components/SectionFooter";
import Button from "@/components/Button";
import SelectField from "@/components/SelectField";
import TextAreaField from "@/components/TextAreaField";
import SectionField from "@/components/SectionField";
import PersonaSection from "@/components/PersonaSection";
import SkillsSection from "@/components/SkillsSection";

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

  // Normalize agent data so the skills field array always has an array.
  const normalizedAgent = useMemo(() => {
    if (!agent) return undefined;
    return {
      ...agent,
      extra: {
        ...agent.extra,
        skills: agent.extra?.skills ?? [],
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

    const convId = startConversation({
      organization_id: activeOrgId,
      organization_address: localAddress.address,
      service: "local",
      extra: { default_agent_id: agentId },
      name: agent?.name,
    });

    navigate({ hash: convId });
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
          deleteDisabledReason={t("Requiere permisos de administrador")}
          deleteLoading={deleteAgent.isPending}
        />

        <SectionBody>
          <form
            id="agent-form"
            onSubmit={handleSubmit((data) => updateAgent.mutate(data))}
          >
            <fieldset disabled={!isAdmin} className="contents">
              <label>
                <div className="label">{t("Nombre")}</div>
                <input
                  type="text"
                  className="text"
                  placeholder={t("Nombre del agente")}
                  {...register("name", { required: true })}
                />
              </label>

              <SelectField
                name="extra.mode"
                control={control}
                label={t("Estado")}
                options={[
                  { value: "active", label: t("Activo") },
                  { value: "draft", label: t("Borrador") },
                  { value: "inactive", label: t("Inactivo") },
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

              <p className="text-muted-foreground text-[14px]">
                {t("Los datos del negocio se configuran en")}{" "}
                <Link
                  to="/settings/organization"
                  className="underline"
                  hash={(prevHash) => prevHash!}
                >
                  {t("los ajustes de la organización")}
                </Link>
                .
              </p>

              <SectionField label={t("Avanzado")}>
                <TextAreaField
                  name="extra.instructions"
                  control={control}
                  label={t("Instrucciones adicionales")}
                  placeholder={t("Eres un asistente útil...")}
                />
              </SectionField>
            </fieldset>
          </form>
        </SectionBody>

        <SectionFooter>
          {!isDirty ? (
            <button type="button" className="primary" onClick={handleChat}>
              {t("Chatea con este agente")}
            </button>
          ) : (
            <Button
              form="agent-form"
              type="submit"
              disabled={!isAdmin}
              invalid={!isValid}
              loading={updateAgent.isPending}
              disabledReason={t("Requiere permisos de administrador")}
              className="primary"
            >
              {t("Actualizar")}
            </Button>
          )}
        </SectionFooter>
      </>
    )
  );
}
