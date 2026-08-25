import { useState } from "react";
import {
  useFieldArray,
  useWatch,
  type Control,
  type UseFormRegister,
} from "react-hook-form";
import { Dropdown } from "antd";
import { Plus, ChevronUp, ChevronDown, Trash2 } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import {
  BUTTON_KINDS,
  BTN_LIMITS,
  BTN_TOTAL_MAX,
  BOOKING_URL,
  URL_LIKE_KINDS,
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
  BOOKING: "bg-violet-500/10 text-violet-600",
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

  const counts = buttons.reduce<Record<string, number>>((acc, b) => {
    acc[b.kind] = (acc[b.kind] || 0) + 1;
    return acc;
  }, {});
  const total = buttons.length;

  function disabledReason(kind: ButtonKind): string | null {
    if (total >= BTN_TOTAL_MAX) return `${t("Total limit")}: ${BTN_TOTAL_MAX}`;
    const cap = BTN_LIMITS[kind].max;
    if ((counts[kind] || 0) >= cap)
      return `${t("Maximum")} ${cap} ${t("of this type")}`;
    // Booking buttons reach Meta as URL buttons, so they eat into the same cap.
    if (URL_LIKE_KINDS.includes(kind)) {
      const urlCap = BTN_LIMITS.URL.max;
      const used = URL_LIKE_KINDS.reduce((n, k) => n + (counts[k] || 0), 0);
      if (used >= urlCap)
        return `${t("Maximum")} ${urlCap} ${t("link buttons")}`;
    }
    if (BTN_LIMITS[kind].marketingOnly && category !== "MARKETING")
      return t("Only available for the Marketing category");
    return null;
  }

  const panel = (
    <div
      className="min-w-[280px] p-[6px] rounded-[12px] border border-border bg-popover shadow-lg"
      role="menu"
    >
      <div className="px-[8px] pt-[4px] pb-[6px] text-[11px] text-muted-foreground">
        {t("Choose a button type")}
      </div>
      {BUTTON_KINDS.map((k) => {
        const reason = disabledReason(k);
        return (
          <button
            key={k}
            type="button"
            role="menuitem"
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
  );

  return (
    // Rendered into the trigger's own wrapper rather than <body>: the form
    // scrolls, and a body-portaled popup stays anchored to a trigger that has
    // scrolled away, so antd shifts it against the viewport edge and it slides
    // off under the sidebar. Inside the wrapper it just scrolls with the
    // content. rc-trigger still intersects every scrolling ancestor's clip rect
    // when it decides to flip, so it flips above the trigger near the bottom.
    // No `placement`: antd picks bottomLeft in LTR and bottomRight in RTL from
    // ConfigProvider's direction. Hardcoding one would break Hebrew.
    <Dropdown
      open={open}
      onOpenChange={setOpen}
      trigger={["click"]}
      disabled={total >= BTN_TOTAL_MAX}
      popupRender={() => panel}
      getPopupContainer={(node) => node.parentElement ?? document.body}
    >
      <button
        type="button"
        className="inline-flex items-center gap-[3px] text-primary text-[14px] disabled:opacity-50"
        disabled={total >= BTN_TOTAL_MAX}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Plus className="w-[16px] h-[16px]" />
        {total === 0 ? t("Add button") : t("Add another button")}
      </button>
    </Dropdown>
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
          title={t("Move up")}
        >
          <ChevronUp className="w-[14px] h-[14px]" />
        </button>
        <button
          type="button"
          className="w-[28px] h-[28px] rounded-full inline-flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent"
          onClick={onMoveDown}
          disabled={!canDown}
          title={t("Move down")}
        >
          <ChevronDown className="w-[14px] h-[14px]" />
        </button>
        <button
          type="button"
          className="w-[28px] h-[28px] rounded-full inline-flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-destructive"
          onClick={onRemove}
          title={t("Delete")}
        >
          <Trash2 className="w-[14px] h-[14px]" />
        </button>
      </div>

      {/* button text — fixed label for COPY */}
      <div className={"flex flex-col" + (kind === "QR" ? "" : " mb-[10px]")}>
        <div className="flex items-baseline justify-between">
          <span className="text-[11px] text-muted-foreground mb-[2px]">
            {kind === "COPY" ? t("Button text (fixed)") : t("Button text")}
          </span>
          {kind !== "COPY" && (
            <span className="text-[11px] text-muted-foreground">
              {textValue.length}/{max}
            </span>
          )}
        </div>
        {kind === "COPY" ? (
          <div className="text-[14px] text-muted-foreground py-[4px]">
            {t("Copy code")}
          </div>
        ) : (
          <input
            className={T_SM}
            maxLength={max}
            placeholder={
              kind === "QR"
                ? t("Yes, I'm interested")
                : kind === "URL"
                  ? t("More info")
                  : kind === "BOOKING"
                    ? t("Book an appointment")
                    : t("Call us")
            }
            {...register(`buttons.${index}.text`, {
              validate: (value) =>
                value?.trim() ? true : t("Button text is required"),
            })}
          />
        )}
      </div>

      {/* URL specifics */}
      {kind === "URL" && (
        <>
          <div className="flex items-center justify-between mb-[8px]">
            <span className="text-[11px] text-muted-foreground">
              {t("URL type")}
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
                {t("Static")}
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
                {t("Dynamic")}
              </button>
            </div>
          </div>
          <div
            className={
              "flex flex-col" + (urlMode === "DYNAMIC" ? " mb-[10px]" : "")
            }
          >
            <span className="text-[11px] text-muted-foreground mb-[2px]">
              {t("URL address")}
              {urlMode === "DYNAMIC" ? " " + t("(with {{1}} at the end)") : ""}
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
                  kind !== "URL" || value?.trim() ? true : t("Enter the URL"),
              })}
            />
          </div>
          {urlMode === "DYNAMIC" && (
            <div className="flex flex-col">
              <span className="text-[11px] text-muted-foreground mb-[2px]">
                {t("Example value for {{1}} (for Meta review)")}
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

      {/* BOOKING specifics — the destination is fixed, so it is shown, not asked
          for. The `{{1}}` suffix becomes each recipient's own booking token. */}
      {kind === "BOOKING" && (
        <div className="flex flex-col">
          <span className="text-[11px] text-muted-foreground mb-[2px]">
            {t("Link (set automatically)")}
          </span>
          <div
            className="text-[13px] font-mono text-muted-foreground pb-[4px] truncate"
            dir="ltr"
          >
            {BOOKING_URL}
          </div>
          <span className="text-[11px] text-muted-foreground mt-[4px] leading-relaxed">
            {t("Each customer receives their own booking link.")}
          </span>
        </div>
      )}

      {/* PHONE specifics */}
      {kind === "PHONE" && (
        <div className="flex gap-[12px]">
          <div className="flex flex-col w-[84px]">
            <span className="text-[11px] text-muted-foreground mb-[2px]">
              {t("Country code")}
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
              {t("Phone number")}
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
                    : t("Enter the phone number"),
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
              {t("Offer code (copied to the customer's clipboard)")}
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
                  : t("Enter the offer code"),
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
  setValue: (
    name: `buttons.${number}.urlMode`,
    value: "STATIC" | "DYNAMIC",
  ) => void;
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
          {t("Buttons")} ({t("optional")})
        </span>
        <span className="text-[11px] text-muted-foreground">
          {fields.length}/{BTN_TOTAL_MAX}
        </span>
      </div>

      {fields.length === 0 ? (
        <div className="rounded-[10px] border border-dashed border-border bg-card/50 p-[14px] mb-[8px]">
          <div className="text-[13px] text-foreground mb-[4px]">
            {t("Add interactive buttons to the message")}
          </div>
          <div className="text-[12px] text-muted-foreground leading-relaxed">
            {t(
              "One-tap quick replies, a link to your site, a call, or a coupon code to copy.",
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

      <div className="relative mt-[10px]">
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
