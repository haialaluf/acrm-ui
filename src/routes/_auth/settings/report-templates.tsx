import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  FileText,
  Plus,
  Trash2,
} from "lucide-react";
import SectionHeader from "@/components/SectionHeader";
import SectionBody from "@/components/SectionBody";
import { useTranslation } from "@/hooks/useTranslation";
import { newId, useTherapyStore } from "@/components/therapy/therapyStore";
import type {
  ReportTemplate,
  SectionType,
  TemplateSection,
} from "@/components/therapy/templates";

export const Route = createFileRoute("/_auth/settings/report-templates")({
  component: ReportTemplates,
});

const TYPE_LABELS: Record<SectionType, string> = {
  text: "Text",
  number: "Number",
  yesno: "Yes / No",
  checkboxes: "Checkboxes",
  fields: "Sub-fields",
};

function SectionEditor({
  section,
  onChange,
  onDelete,
  onMove,
}: {
  section: TemplateSection;
  onChange: (section: TemplateSection) => void;
  onDelete: () => void;
  onMove: (delta: number) => void;
}) {
  const { translate: t } = useTranslation();
  const [open, setOpen] = useState(false);
  const list = section.type === "checkboxes" ? section.options : section.fields;

  return (
    <div
      className={
        "rounded-[12px] border bg-popover " +
        (open ? "border-primary" : "border-border")
      }
    >
      <button
        type="button"
        className="w-full flex items-center gap-[10px] px-[12px] py-[10px] text-start"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="grow min-w-0 text-[14px] text-card-foreground truncate">
          {section.title || t("Untitled section")}
        </span>
        <span className="text-[12px] px-[8px] py-[2px] rounded-[8px] bg-muted text-muted-foreground shrink-0">
          {t(TYPE_LABELS[section.type])}
          {list?.length ? ` · ${list.length}` : ""}
        </span>
        <ChevronRight
          className={
            "w-[16px] h-[16px] text-muted-foreground transition-transform " +
            (open ? "rotate-90" : "rtl:rotate-180")
          }
        />
      </button>
      {open && (
        <div className="px-[12px] pb-[12px] flex flex-col gap-[12px]">
          <label>
            <div className="label">{t("Section title")}</div>
            <input
              className="text"
              value={section.title}
              onChange={(e) => onChange({ ...section, title: e.target.value })}
            />
          </label>
          <label>
            <div className="label">{t("Type")}</div>
            <select
              className="text w-full bg-transparent"
              value={section.type}
              onChange={(e) =>
                onChange({ ...section, type: e.target.value as SectionType })
              }
            >
              {(Object.keys(TYPE_LABELS) as SectionType[]).map((type) => (
                <option key={type} value={type}>
                  {t(TYPE_LABELS[type])}
                </option>
              ))}
            </select>
          </label>
          {(section.type === "checkboxes" || section.type === "fields") && (
            <label>
              <div className="label">
                {section.type === "checkboxes"
                  ? t("Options, one per line")
                  : t("Sub-fields, one per line")}
              </div>
              <textarea
                className="text"
                rows={Math.max(3, list?.length ?? 0)}
                value={(list ?? []).join("\n")}
                onChange={(e) => {
                  const lines = e.target.value.split("\n");
                  onChange(
                    section.type === "checkboxes"
                      ? { ...section, options: lines }
                      : { ...section, fields: lines },
                  );
                }}
              />
            </label>
          )}
          <label>
            <div className="label">{t("What should the AI listen for?")}</div>
            <textarea
              className="text"
              rows={2}
              placeholder={t(
                "Optional. For example: only fill this if it was said explicitly.",
              )}
              value={section.hint ?? ""}
              onChange={(e) => onChange({ ...section, hint: e.target.value })}
            />
          </label>
          <button
            type="button"
            className="flex items-center gap-[10px] text-[13px] text-start"
            onClick={() => onChange({ ...section, confirm: !section.confirm })}
          >
            <span
              className={
                "w-[34px] h-[20px] rounded-full relative shrink-0 " +
                (section.confirm ? "bg-primary" : "bg-input")
              }
            >
              <span
                className={
                  "absolute top-[2px] w-[16px] h-[16px] rounded-full bg-white transition-all " +
                  (section.confirm ? "start-[16px]" : "start-[2px]")
                }
              />
            </span>
            {t("Always ask the therapist to confirm this section")}
          </button>
          <div className="flex items-center gap-[6px]">
            <button
              type="button"
              title={t("Move up")}
              className="w-[32px] h-[32px] rounded-full border border-border flex items-center justify-center"
              onClick={() => onMove(-1)}
            >
              <ArrowUp className="w-[15px] h-[15px]" />
            </button>
            <button
              type="button"
              title={t("Move down")}
              className="w-[32px] h-[32px] rounded-full border border-border flex items-center justify-center"
              onClick={() => onMove(1)}
            >
              <ArrowDown className="w-[15px] h-[15px]" />
            </button>
            <button
              type="button"
              className="ms-auto flex items-center gap-[6px] text-[13px] text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="w-[14px] h-[14px]" />
              {t("Remove section")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function TemplateEditor({
  template,
  onBack,
}: {
  template: ReportTemplate;
  onBack: () => void;
}) {
  const { translate: t } = useTranslation();
  const store = useTherapyStore();
  const save = (next: ReportTemplate) => store.saveTemplate(next);

  function updateSection(index: number, section: TemplateSection) {
    save({
      ...template,
      sections: template.sections.map((s, i) => (i === index ? section : s)),
    });
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= template.sections.length) return;
    const sections = [...template.sections];
    [sections[index], sections[target]] = [sections[target], sections[index]];
    save({ ...template, sections });
  }

  return (
    <>
      <SectionHeader
        title={template.name || t("New template")}
        onBack={onBack}
        onDelete={() => {
          store.deleteTemplate(template.id);
          onBack();
        }}
      />
      <SectionBody className="gap-[12px] px-[10px] pb-[20px]">
        <label>
          <div className="label">{t("Template name")}</div>
          <input
            className="text"
            value={template.name}
            onChange={(e) => save({ ...template, name: e.target.value })}
          />
        </label>
        <label>
          <div className="label">{t("When to use it")}</div>
          <input
            className="text"
            value={template.description}
            onChange={(e) => save({ ...template, description: e.target.value })}
          />
        </label>
        <div className="label mt-[6px]">
          {t("Sections")} ({template.sections.length})
        </div>
        {template.sections.map((section, i) => (
          <SectionEditor
            key={section.id}
            section={section}
            onChange={(next) => updateSection(i, next)}
            onMove={(delta) => move(i, delta)}
            onDelete={() =>
              save({
                ...template,
                sections: template.sections.filter((_, j) => j !== i),
              })
            }
          />
        ))}
        <button
          type="button"
          className="flex items-center justify-center gap-[8px] h-[42px] rounded-[12px] border border-dashed border-primary text-primary text-[14px]"
          onClick={() =>
            save({
              ...template,
              sections: [
                ...template.sections,
                { id: newId(), title: t("New section"), type: "text" },
              ],
            })
          }
        >
          <Plus className="w-[16px] h-[16px]" />
          {t("Add section")}
        </button>
      </SectionBody>
    </>
  );
}

function ReportTemplates() {
  const { translate: t } = useTranslation();
  const store = useTherapyStore();
  const [editing, setEditing] = useState<string | null>(null);
  const template = store.templates.find((tpl) => tpl.id === editing);

  if (template) {
    return (
      <TemplateEditor template={template} onBack={() => setEditing(null)} />
    );
  }

  return (
    <>
      <SectionHeader title={t("Report templates")} />
      <SectionBody className="gap-[10px] px-[10px]">
        <p className="text-[13px] text-muted-foreground">
          {t(
            "When you record a session, the AI fills in one of these templates from the conversation.",
          )}
        </p>
        {store.templates.map((tpl) => (
          <button
            key={tpl.id}
            type="button"
            className="flex items-center gap-[12px] px-[12px] py-[12px] rounded-[12px] border border-border bg-popover text-start hover:bg-accent"
            onClick={() => setEditing(tpl.id)}
          >
            <span className="w-[38px] h-[38px] rounded-[10px] bg-accent text-accent-foreground flex items-center justify-center shrink-0">
              <FileText className="w-[18px] h-[18px]" />
            </span>
            <div className="grow min-w-0">
              <div className="text-[14px] text-card-foreground truncate">
                {tpl.name}
              </div>
              <div className="text-[12px] text-muted-foreground">
                {tpl.description} · {tpl.sections.length} {t("sections")}
              </div>
            </div>
            <ChevronRight className="w-[16px] h-[16px] text-muted-foreground rtl:rotate-180" />
          </button>
        ))}
        <button
          type="button"
          className="flex items-center justify-center gap-[8px] h-[42px] rounded-[12px] border border-dashed border-primary text-primary text-[14px]"
          onClick={() => {
            const id = newId();
            store.saveTemplate({
              id,
              name: t("New template"),
              description: t("Custom"),
              sections: [{ id: newId(), title: t("Summary"), type: "text" }],
            });
            setEditing(id);
          }}
        >
          <Plus className="w-[16px] h-[16px]" />
          {t("New template")}
        </button>
      </SectionBody>
    </>
  );
}
