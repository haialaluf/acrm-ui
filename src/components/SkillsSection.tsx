import { useState } from "react";
import {
  type Control,
  type FieldValues,
  type Path,
  useFieldArray,
  type UseFormRegister,
  type UseFormSetValue,
  useWatch,
} from "react-hook-form";
import {
  ArrowLeft,
  Calendar,
  Check,
  ChevronRight,
  Database,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "@/hooks/useTranslation";
import SectionField from "@/components/SectionField";
import SectionBody from "@/components/SectionBody";
import SelectField, { type SelectOption } from "@/components/SelectField";
import TextAreaField from "@/components/TextAreaField";
import Switch from "@/components/Switch";
import { useCalendars } from "@/queries/useCalendars";
import {
  DEFAULT_SKILL_MODEL,
  MODEL_OPTIONS,
  modelLabel,
} from "@/models/catalog";
import {
  type SkillCatalogEntry,
  type SkillConfigField,
  SKILL_CATALOG,
} from "@/skills/catalog";
import { openGoogleOAuth } from "@/utils/googleOAuth";
import { useAcrmMcpKey } from "@/hooks/useAcrmMcpKey";

type SkillsSectionProps<T extends FieldValues> = {
  control: Control<T>;
  register: UseFormRegister<T>;
  setValue: UseFormSetValue<T>;
  disabled?: boolean;
};

const ICONS: Record<string, typeof Calendar> = {
  calendar: Calendar,
  database: Database,
};

/**
 * Skills gallery + per-skill editor over `useFieldArray({name: "extra.skills"})`.
 * Skills are platform-defined (mirrored from `@/skills/catalog`); enabling one
 * appends a `SkillInstance`, disabling removes it. Each configSpec field is
 * rendered generically: `acrm_api_key`/`google_oauth` fields use the connection
 * flows extracted from the former ToolsSection, and `calendar_select` fills its
 * options from the org's calendars.
 */
export default function SkillsSection<T extends FieldValues>({
  control,
  register,
  setValue,
  disabled,
}: SkillsSectionProps<T>) {
  const { translate: t } = useTranslation();
  const [editingId, setEditingId] = useState<string | null>(null);

  // "" is the explicit "use the platform default" choice — the API reads it as
  // falsy and falls back to DEFAULT_SKILL_MODEL.
  const defaultSkillModelLabel = `${t("Default")} (${modelLabel(
    DEFAULT_SKILL_MODEL,
  )})`;

  const skillModelOptions: SelectOption[] = [
    { value: "", label: defaultSkillModelLabel },
    ...MODEL_OPTIONS,
  ];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { append, remove } = useFieldArray({
    control,
    name: "extra.skills" as any,
  });

  const instances =
    (useWatch({
      control,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      name: "extra.skills" as any,
    }) as { id: string }[] | undefined) || [];

  const indexOf = (id: string) => instances.findIndex((s) => s?.id === id);
  const enabledCount = SKILL_CATALOG.filter((s) => indexOf(s.id) > -1).length;

  const toggle = (entry: SkillCatalogEntry, enable: boolean) => {
    const index = indexOf(entry.id);

    if (enable && index === -1) {
      // Seed configSpec defaults so the editor starts from sensible values.
      const config: Record<string, unknown> = {};
      for (const field of entry.configSpec) {
        if (field.default !== undefined) config[field.key] = field.default;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      append({ id: entry.id, config } as any);
      setEditingId(entry.id);
    } else if (!enable && index > -1) {
      remove(index);
      if (editingId === entry.id) setEditingId(null);
    }
  };

  const editingEntry = SKILL_CATALOG.find((s) => s.id === editingId);
  const editingIndex = editingEntry ? indexOf(editingEntry.id) : -1;

  return (
    <SectionField
      label={t("Skills")}
      description={enabledCount ? `${enabledCount} ${t("active")}` : t("None")}
      disabled={disabled}
    >
      {SKILL_CATALOG.map((entry) => {
        const Icon = ICONS[entry.icon] ?? Calendar;
        const enabled = indexOf(entry.id) > -1;

        return (
          <div key={entry.id} className="flex items-start gap-[12px]">
            <Icon className="w-[24px] h-[24px] text-muted-foreground shrink-0 mt-[2px]" />

            <button
              type="button"
              className="flex flex-col text-left grow min-w-0"
              onClick={() => enabled && setEditingId(entry.id)}
              disabled={!enabled}
            >
              <span className="text-foreground flex items-center gap-[6px]">
                {t(entry.title)}
                {enabled && (
                  <ChevronRight className="w-[16px] h-[16px] text-muted-foreground" />
                )}
              </span>
              <span className="text-muted-foreground text-[14px]">
                {t(entry.description)}
              </span>
            </button>

            <Switch
              checked={enabled}
              disabled={disabled}
              onChange={(e) => toggle(entry, e.target.checked)}
            />
          </div>
        );
      })}

      {editingEntry && editingIndex > -1 && (
        <div className="absolute inset-0 bottom-[80px] z-[60] bg-background flex flex-col">
          <div className="header items-center truncate shrink-0">
            <button
              type="button"
              className="p-[8px] rounded-full hover:bg-muted me-[8px] ms-[-8px]"
              title={t("Back")}
              onClick={() => setEditingId(null)}
            >
              <ArrowLeft className="w-[24px] h-[24px]" />
            </button>
            <div className="text-[16px]">{t(editingEntry.title)}</div>
          </div>

          <SectionBody className="gap-[24px] pl-[10px]">
            {editingEntry.configSpec.map((field) => (
              <SkillConfigFieldInput
                key={field.key}
                field={field}
                index={editingIndex}
                control={control}
                register={register}
                setValue={setValue}
                disabled={disabled}
              />
            ))}

            {/* Mirrors the root agent's Advanced section (see
                routes/_auth/agents/$agentId.tsx). The skill runs as a nested
                sub-agent on its own model, independent of the root agent's;
                leaving it unset ("") keeps the instance on the platform
                default, so it tracks future changes instead of freezing
                today's value. */}
            <SectionField
              label={t("Advanced")}
              disabled={disabled}
              modalClassName="bottom-0"
            >
              <SelectField
                name={`extra.skills.${editingIndex}.model` as Path<T>}
                control={control}
                label={t("Model")}
                options={skillModelOptions}
                placeholder={defaultSkillModelLabel}
                disabled={disabled}
                modalClassName="bottom-0"
              />
            </SectionField>
          </SectionBody>
        </div>
      )}
    </SectionField>
  );
}

function SkillConfigFieldInput<T extends FieldValues>({
  field,
  index,
  control,
  register,
  setValue,
  disabled,
}: {
  field: SkillConfigField;
  index: number;
  control: Control<T>;
  register: UseFormRegister<T>;
  setValue: UseFormSetValue<T>;
  disabled?: boolean;
}) {
  const { translate: t } = useTranslation();
  const acrm = useAcrmMcpKey();
  // Options the static catalog cannot enumerate — the org's own calendars.
  const calendars = useCalendars().data ?? [];

  const configPath = `extra.skills.${index}.config.${field.key}` as Path<T>;
  const connectionPath =
    `extra.skills.${index}.connections.${field.key}` as Path<T>;

  const connection = useWatch({ control, name: connectionPath }) as
    | { token?: string; email?: string }
    | undefined;

  const authorized = !!connection?.token;

  const authorize = (token: string, extra?: Record<string, unknown>) => {
    setValue(
      connectionPath,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { token, ...extra } as any,
      { shouldDirty: true, shouldValidate: true, shouldTouch: true },
    );
  };

  switch (field.type) {
    case "text":
      return (
        <label>
          <div className="label">{t(field.label)}</div>
          <input
            type="text"
            className="text"
            placeholder={field.placeholder ? t(field.placeholder) : undefined}
            disabled={disabled}
            {...register(configPath, { required: field.required })}
          />
        </label>
      );

    case "number":
      return (
        <label>
          <div className="label">{t(field.label)}</div>
          <input
            type="number"
            className="text"
            placeholder={field.placeholder ? t(field.placeholder) : undefined}
            disabled={disabled}
            {...register(configPath, {
              required: field.required,
              valueAsNumber: true,
            })}
          />
        </label>
      );

    case "textarea":
      return (
        <TextAreaField
          name={configPath}
          control={control}
          label={t(field.label)}
          placeholder={field.placeholder ? t(field.placeholder) : undefined}
          disabled={disabled}
          modalClassName="bottom-0"
        />
      );

    case "boolean":
      return (
        <div className="flex items-center justify-between">
          <div className="label">{t(field.label)}</div>
          <input
            type="checkbox"
            disabled={disabled}
            {...register(configPath)}
          />
        </div>
      );

    case "select":
      return (
        <SelectField
          name={configPath}
          control={control}
          label={t(field.label)}
          options={(field.options ?? []).map((o) => ({
            value: o.value,
            label: t(o.label),
          }))}
          required={field.required}
          disabled={disabled}
        />
      );

    case "calendar_select":
      return (
        <div>
          {calendars.length > 0 ? (
            <SelectField
              name={configPath}
              control={control}
              label={t(field.label)}
              options={calendars.map((calendar) => ({
                value: calendar.id,
                label: calendar.name,
              }))}
              required={field.required}
              disabled={disabled}
              modalClassName="bottom-0"
            />
          ) : (
            <>
              <div className="label">{t(field.label)}</div>
              <p className="text-muted-foreground text-[14px]">
                {t("No calendars yet.")}
              </p>
            </>
          )}

          {/* Leaves the agent form, so unsaved edits are lost — the same
              trade-off as the organization settings link on the agent page. */}
          <Link
            to="/calendars/new"
            className="underline text-[14px] inline-block mt-[8px]"
            hash={(prevHash) => prevHash!}
          >
            {t("Create a new calendar")}
          </Link>
        </div>
      );

    case "multiselect":
      return (
        <SelectField
          multiple
          name={configPath}
          control={control}
          label={t(field.label)}
          options={(field.options ?? []).map((o) => ({
            value: o.value,
            label: t(o.label),
          }))}
          disabled={disabled}
        />
      );

    case "google_oauth":
      return (
        <div>
          <div className="label mb-[8px]">{t(field.label)}</div>
          <button
            type="button"
            className="bg-secondary text-secondary-foreground hover:bg-secondary/80 px-4 py-2 rounded-full font-medium transition-colors w-fit text-[14px] flex items-center gap-2"
            disabled={disabled}
            onClick={async () => {
              try {
                const result = await openGoogleOAuth(
                  field.product ?? "calendar",
                );
                authorize(`Bearer ${result.apiKey}`, {
                  email: result.email,
                  url: result.url,
                });
              } catch {
                // Popup blocked or closed — leave the connection untouched.
              }
            }}
          >
            {authorized && <Check className="w-4 h-4" />}
            {authorized ? connection?.email || t("Authorized") : t("Authorize")}
          </button>
        </div>
      );

    case "acrm_api_key":
      return (
        <div>
          <div className="label mb-[8px]">{t(field.label)}</div>
          <button
            type="button"
            className="bg-secondary text-secondary-foreground hover:bg-secondary/80 px-4 py-2 rounded-full font-medium transition-colors w-fit text-[14px] flex items-center gap-2 disabled:opacity-40"
            disabled={disabled || !acrm.isOwner || !acrm.isReady}
            onClick={async () => {
              const token = await acrm.provision();
              if (token) authorize(token);
            }}
          >
            {authorized && <Check className="w-4 h-4" />}
            {authorized ? t("Connected") : t("Connect")}
          </button>
          {!acrm.isOwner && (
            <p className="text-muted-foreground text-[14px] mt-[8px]">
              {t("Requires owner permissions to connect.")}
            </p>
          )}
        </div>
      );

    default:
      return null;
  }
}
