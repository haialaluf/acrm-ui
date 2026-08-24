import {
  useFieldArray,
  useWatch,
  type Control,
  type FieldValues,
  type Path,
  type UseFormRegister,
} from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import SectionField from "@/components/SectionField";
import SwitchField from "@/components/SwitchField";

type FaqSectionProps<T extends FieldValues> = {
  control: Control<T>;
  register: UseFormRegister<T>;
  disabled?: boolean;
  // Forwarded to `SectionField` — this one opens inside the Advanced panel, so
  // it needs "bottom-0" or the default inset applies twice.
  modalClassName?: string;
};

/**
 * The answers the company wrote for the questions it gets most, stored at
 * `extra.faq` and rendered by the API's `renderFaq` as its own prompt section.
 *
 * Rows rather than one textarea because of how this field is actually used: a
 * company revisits ONE answer when a price or a policy moves, and editing that
 * inside a wall of prose is where the structure gets broken. It also lets the
 * platform frame the list in the prompt, which a paragraph pasted into
 * "Additional instructions" cannot do.
 */
export default function FaqSection<T extends FieldValues>({
  control,
  register,
  disabled,
  modalClassName,
}: FaqSectionProps<T>) {
  const { translate: t } = useTranslation();

  // `as any`: react-hook-form cannot prove `extra.faq` is an array path on a
  // generic T. Same workaround as `SkillsSection`.
  const { fields, append, remove } = useFieldArray({
    control,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    name: "extra.faq" as any,
  });

  // Counted off live values, not `fields`: a row the user added and never
  // filled is not an answer the agent has, and the API drops it too.
  const entries =
    (useWatch({
      control,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      name: "extra.faq" as any,
    }) as { question?: string; answer?: string }[] | undefined) || [];

  const usable = entries.filter(
    (e) => e?.question?.trim() && e?.answer?.trim(),
  ).length;

  return (
    <SectionField
      label={t("Frequently asked questions")}
      description={usable ? `${usable} ${t("answers")}` : t("None")}
      disabled={disabled}
      modalClassName={modalClassName}
    >
      <p className="text-muted-foreground text-[14px]">
        {t(
          "The agent gives these answers when a client asks one of these questions. Questions you don't list here aren't treated as a no — the agent says it will come back with an answer.",
        )}
      </p>

      {fields.map((field, i) => (
        <div
          key={field.id}
          className="flex flex-col gap-[12px] rounded-[10px] border border-border p-[14px]"
        >
          <div className="flex items-start gap-[8px]">
            <label className="grow min-w-0">
              <div className="label">{t("Question")}</div>
              <input
                className="text"
                placeholder={t("How much does it cost?")}
                disabled={disabled}
                {...register(`extra.faq.${i}.question` as Path<T>)}
              />
            </label>

            <button
              type="button"
              className="p-[8px] rounded-full hover:bg-muted shrink-0 mt-[18px]"
              title={t("Remove")}
              onClick={() => remove(i)}
              disabled={disabled}
            >
              <Trash2 className="w-[18px] h-[18px] text-muted-foreground" />
            </button>
          </div>

          <label>
            <div className="label">{t("Answer")}</div>
            <textarea
              className="text"
              rows={3}
              placeholder={t(
                "It depends on the scope — tell me what you need.",
              )}
              disabled={disabled}
              {...register(`extra.faq.${i}.answer` as Path<T>)}
            />
          </label>

          <SwitchField
            name={`extra.faq.${i}.verbatim` as Path<T>}
            control={control}
            label={t("Send this wording exactly")}
            description={t(
              "For answers where the phrasing matters — disclaimers, anything you don't want reworded.",
            )}
            disabled={disabled}
          />
        </div>
      ))}

      <button
        type="button"
        className="flex items-center gap-[8px] text-primary"
        onClick={() =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          append({ question: "", answer: "" } as any)
        }
        disabled={disabled}
      >
        <Plus className="w-[18px] h-[18px]" />
        {t("Add question")}
      </button>
    </SectionField>
  );
}
