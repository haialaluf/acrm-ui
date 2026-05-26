import { useEffect, useRef, useState } from "react";
import {
  useFieldArray,
  useWatch,
  type Control,
  type UseFormRegister,
} from "react-hook-form";
import {
  Plus,
  ChevronUp,
  ChevronDown,
  Trash2,
} from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import {
  BUTTON_KINDS,
  BTN_LIMITS,
  BTN_TOTAL_MAX,
  KIND_LABEL,
  KIND_HINT,
  ButtonKindIcon,
  newTemplateButton,
  type ButtonKind,
  type FormTemplateButton,
} from "./templateButtons";
import type { TemplateFormData } from "./templateEditorTypes";

// Small underlined input matching the design's `.t-sm` field.
const T_SM =
  "w-full pb-[4px] border-b-[1.5px] border-transparent hover:border-input focus:border-primary focus-visible:outline-none text-[14px] bg-transparent text-foreground placeholder:text-muted-foreground";
const MONO = " font-mono text-left";

const CHIP_CLASS: Record<ButtonKind, string> = {
  QR: "bg-primary/10 text-primary",
  URL: "bg-sky-500/10 text-sky-600",
  PHONE: "bg-emerald-500/10 text-emerald-600",
  COPY: "bg-amber-500/10 text-amber-600",
};

/* ─── add-button dropdown ─────────────────────────────────────────────── */
function AddButtonMenu({
  buttons,
  category,
  onAdd,
}: {
  buttons: FormTemplateButton[];
  category: TemplateFormData["category"];
  onAdd: (kind: ButtonKind) => void;
}) {
  const { translate: t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const counts = buttons.reduce<Record<string, number>>((acc, b) => {
    acc[b.kind] = (acc[b.kind] || 0) + 1;
    return acc;
  }, {});
  const total = buttons.length;

  function disabledReason(kind: ButtonKind): string | null {
    if (total >= BTN_TOTAL_MAX) return `${t("Límite total")}: ${BTN_TOTAL_MAX}`;
    const cap = BTN_LIMITS[kind].max;
    if ((counts[kind] || 0) >= cap) return `${t("Máximo")} ${cap} ${t("de este tipo")}`;
    if (BTN_LIMITS[kind].marketingOnly && category !== "MARKETING")
      return t("Solo disponible para la categoría Promoción");
    return null;
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="inline-flex items-center gap-[3px] text-primary text-[14px] disabled:opacity-50"
        onClick={() => setOpen((o) => !o)}
        disabled={total >= BTN_TOTAL_MAX}
      >
        <Plus className="w-[16px] h-[16px]" />
        {total === 0 ? t("Agregar botón") : t("Agregar otro botón")}
      </button>

      {open && (
        <div
          className="absolute top-[calc(100%+6px)] start-0 z-30 min-w-[280px] p-[6px] rounded-[12px] border border-border bg-popover shadow-lg"
          role="menu"
        >
          <div className="px-[8px] pt-[4px] pb-[6px] text-[11px] text-muted-foreground">
            {t("Elegí un tipo de botón")}
          </div>
          {BUTTON_KINDS.map((k) => {
            const reason = disabledReason(k);
            return (
              <button
                key={k}
                type="button"
                className="w-full flex items-center gap-[10px] p-[10px] rounded-[8px] text-start text-[14px] text-foreground hover:bg-accent disabled:opacity-40 disabled:cursor-default"
                disabled={!!reason}
                onClick={() => {
                  onAdd(k);
                  setOpen(false);
                }}
              >
                <span
                  className={`w-[32px] h-[32px] rounded-[9px] inline-flex items-center justify-center shrink-0 ${CHIP_CLASS[k]}`}
                >
                  <ButtonKindIcon kind={k} className="w-[16px] h-[16px]" />
                </span>
                <div className="flex-1 min-w-0">
                  <div>{t(KIND_LABEL[k])}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {reason || t(KIND_HINT[k])}
                  </div>
                </div>
                <div className="text-[11px] text-muted-foreground min-w-[30px] text-end">
                  {counts[k] || 0}/{BTN_LIMITS[k].max}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── single button card ──────────────────────────────────────────────── */
function ButtonCard({
  index,
  kind,
  urlMode,
  register,
  control,
  onRemove,
  onMoveUp,
  onMoveDown,
  canUp,
  canDown,
  setUrlMode,
}: {
  index: number;
  kind: ButtonKind;
  urlMode: "STATIC" | "DYNAMIC";
  register: UseFormRegister<TemplateFormData>;
  control: Control<TemplateFormData>;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canUp: boolean;
  canDown: boolean;
  setUrlMode: (mode: "STATIC" | "DYNAMIC") => void;
}) {
  const { translate: t } = useTranslation();
  const max = BTN_LIMITS[kind].textMax;

  const textValue = useWatch({ control, name: `buttons.${index}.text` }) || "";
  const codeValue = useWatch({ control, name: `buttons.${index}.code` }) || "";

  return (
    <div className="rounded-[10px] border border-border bg-background p-[12px] mt-[8px]">
      {/* header row: chip + reorder + delete */}
      <div className="flex items-center gap-[8px] mb-[10px]">
        <span
          className={`inline-flex items-center gap-[6px] px-[8px] py-[3px] rounded-full text-[11px] ${CHIP_CLASS[kind]}`}
        >
          <ButtonKindIcon kind={kind} className="w-[12px] h-[12px]" />
          {t(KIND_LABEL[kind])}
        </span>
        <div className="flex-1" />
        <button
          type="button"
          className="w-[28px] h-[28px] rounded-full inline-flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent"
          onClick={onMoveUp}
          disabled={!canUp}
          title={t("Mover arriba")}
        >
          <ChevronUp className="w-[14px] h-[14px]" />
        </button>
        <button
          type="button"
          className="w-[28px] h-[28px] rounded-full inline-flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent"
          onClick={onMoveDown}
          disabled={!canDown}
          title={t("Mover abajo")}
        >
          <ChevronDown className="w-[14px] h-[14px]" />
        </button>
        <button
          type="button"
          className="w-[28px] h-[28px] rounded-full inline-flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-destructive"
          onClick={onRemove}
          title={t("Eliminar")}
        >
          <Trash2 className="w-[14px] h-[14px]" />
        </button>
      </div>

      {/* button text — fixed label for COPY */}
      <div className={"flex flex-col" + (kind === "QR" ? "" : " mb-[10px]")}>
        <div className="flex items-baseline justify-between">
          <span className="text-[11px] text-muted-foreground mb-[2px]">
            {kind === "COPY" ? t("Texto del botón (fijo)") : t("Texto del botón")}
          </span>
          {kind !== "COPY" && (
            <span className="text-[11px] text-muted-foreground">
              {textValue.length}/{max}
            </span>
          )}
        </div>
        {kind === "COPY" ? (
          <div className="text-[14px] text-muted-foreground py-[4px]">
            {t("Copiar código")}
          </div>
        ) : (
          <input
            className={T_SM}
            maxLength={max}
            placeholder={
              kind === "QR"
                ? t("Sí, me interesa")
                : kind === "URL"
                  ? t("Más información")
                  : t("Llamanos")
            }
            {...register(`buttons.${index}.text`, {
              validate: (value) =>
                value?.trim() ? true : t("El texto del botón es obligatorio"),
            })}
          />
        )}
      </div>

      {/* URL specifics */}
      {kind === "URL" && (
        <>
          <div className="flex items-center justify-between mb-[8px]">
            <span className="text-[11px] text-muted-foreground">
              {t("Tipo de URL")}
            </span>
            <div className="inline-flex p-[2px] bg-muted rounded-full">
              <button
                type="button"
                className={
                  "px-[10px] py-[4px] text-[12px] rounded-full " +
                  (urlMode === "STATIC"
                    ? "bg-background text-foreground shadow"
                    : "text-muted-foreground")
                }
                onClick={() => setUrlMode("STATIC")}
              >
                {t("Estática")}
              </button>
              <button
                type="button"
                className={
                  "px-[10px] py-[4px] text-[12px] rounded-full " +
                  (urlMode === "DYNAMIC"
                    ? "bg-background text-foreground shadow"
                    : "text-muted-foreground")
                }
                onClick={() => setUrlMode("DYNAMIC")}
              >
                {t("Dinámica")}
              </button>
            </div>
          </div>
          <div className={"flex flex-col" + (urlMode === "DYNAMIC" ? " mb-[10px]" : "")}>
            <span className="text-[11px] text-muted-foreground mb-[2px]">
              {t("Dirección URL")}
              {urlMode === "DYNAMIC" ? " " + t("(con {{1}} al final)") : ""}
            </span>
            <input
              className={T_SM + MONO}
              dir="ltr"
              placeholder={
                urlMode === "DYNAMIC"
                  ? "https://example.com/order/{{1}}"
                  : "https://example.com/promo"
              }
              {...register(`buttons.${index}.url`, {
                validate: (value) =>
                  kind !== "URL" || value?.trim()
                    ? true
                    : t("Ingresá la dirección URL"),
              })}
            />
          </div>
          {urlMode === "DYNAMIC" && (
            <div className="flex flex-col">
              <span className="text-[11px] text-muted-foreground mb-[2px]">
                {t("Valor de ejemplo para {{1}} (para revisión de Meta)")}
              </span>
              <input
                className={T_SM + MONO}
                dir="ltr"
                placeholder="12345"
                {...register(`buttons.${index}.urlExample`)}
              />
            </div>
          )}
        </>
      )}

      {/* PHONE specifics */}
      {kind === "PHONE" && (
        <div className="flex gap-[12px]">
          <div className="flex flex-col w-[84px]">
            <span className="text-[11px] text-muted-foreground mb-[2px]">
              {t("Código de país")}
            </span>
            <select
              className={T_SM + MONO}
              dir="ltr"
              {...register(`buttons.${index}.countryCode`)}
            >
              {["+972", "+1", "+44", "+34", "+55", "+91"].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col flex-1">
            <span className="text-[11px] text-muted-foreground mb-[2px]">
              {t("Número de teléfono")}
            </span>
            <input
              className={T_SM + MONO}
              dir="ltr"
              placeholder="54 123 4567"
              {...register(`buttons.${index}.phone`, {
                onChange: (e) => {
                  e.target.value = e.target.value.replace(/[^\d\s-]/g, "");
                },
                validate: (value) =>
                  kind !== "PHONE" || value?.trim()
                    ? true
                    : t("Ingresá el número de teléfono"),
              })}
            />
          </div>
        </div>
      )}

      {/* COPY specifics */}
      {kind === "COPY" && (
        <div className="flex flex-col">
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] text-muted-foreground mb-[2px]">
              {t("Código de oferta (se copia al portapapeles del cliente)")}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {codeValue.length}/15
            </span>
          </div>
          <input
            className={T_SM + MONO}
            maxLength={15}
            dir="ltr"
            placeholder="WELCOME20"
            {...register(`buttons.${index}.code`, {
              onChange: (e) => {
                e.target.value = e.target.value.toUpperCase();
              },
              validate: (value) =>
                kind !== "COPY" || value?.trim()
                  ? true
                  : t("Ingresá el código de oferta"),
            })}
          />
        </div>
      )}
    </div>
  );
}

/* ─── the whole section ───────────────────────────────────────────────── */
export default function TemplateButtonsField({
  control,
  register,
  setValue,
  category,
}: {
  control: Control<TemplateFormData>;
  register: UseFormRegister<TemplateFormData>;
  setValue: (name: `buttons.${number}.urlMode`, value: "STATIC" | "DYNAMIC") => void;
  category: TemplateFormData["category"];
}) {
  const { translate: t } = useTranslation();
  const { fields, append, remove, move } = useFieldArray({
    control,
    name: "buttons",
  });

  // Live values drive conditional UI (kind/urlMode) and the quota counters.
  const buttons = (useWatch({ control, name: "buttons" }) ||
    []) as FormTemplateButton[];

  const counts = buttons.reduce<Record<string, number>>((acc, b) => {
    acc[b.kind] = (acc[b.kind] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col">
      <div className="flex items-baseline justify-between mb-[8px]">
        <span className="label !mb-0">
          {t("Botones")} ({t("opcional")})
        </span>
        <span className="text-[11px] text-muted-foreground">
          {fields.length}/{BTN_TOTAL_MAX}
        </span>
      </div>

      {fields.length === 0 ? (
        <div className="rounded-[10px] border border-dashed border-border bg-card/50 p-[14px] mb-[8px]">
          <div className="text-[13px] text-foreground mb-[4px]">
            {t("Agregá botones interactivos al mensaje")}
          </div>
          <div className="text-[12px] text-muted-foreground leading-relaxed">
            {t(
              "Respuestas rápidas con un toque, un enlace a tu sitio, llamada, o un código de cupón para copiar.",
            )}
          </div>
        </div>
      ) : (
        fields.map((field, i) => (
          <ButtonCard
            key={field.id}
            index={i}
            kind={buttons[i]?.kind ?? field.kind}
            urlMode={buttons[i]?.urlMode ?? field.urlMode}
            register={register}
            control={control}
            onRemove={() => remove(i)}
            onMoveUp={() => move(i, i - 1)}
            onMoveDown={() => move(i, i + 1)}
            canUp={i > 0}
            canDown={i < fields.length - 1}
            setUrlMode={(mode) => setValue(`buttons.${i}.urlMode`, mode)}
          />
        ))
      )}

      <div className="mt-[10px]">
        <AddButtonMenu
          buttons={buttons}
          category={category}
          onAdd={(kind) => append(newTemplateButton(kind))}
        />
      </div>

      {fields.length > 0 && (
        <div className="flex flex-wrap gap-[12px] text-[11px] text-muted-foreground mt-[8px]">
          {BUTTON_KINDS.map((k) => {
            const n = counts[k] || 0;
            const cap = BTN_LIMITS[k].max;
            const cls =
              n === 0
                ? ""
                : n >= cap
                  ? "text-destructive"
                  : n >= cap - 1
                    ? "text-amber-600"
                    : "";
            return (
              <span key={k} className={"inline-flex items-center " + cls}>
                <span className="inline-block w-[4px] h-[4px] rounded-full bg-current me-[5px] align-middle" />
                {t(KIND_LABEL[k])} {n}/{cap}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
