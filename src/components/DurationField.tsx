import { useState } from "react";
import { Dropdown, type MenuProps } from "antd";
import { ChevronDown } from "lucide-react";
import {
  type Control,
  Controller,
  type FieldValues,
  type Path,
} from "react-hook-form";
import { useTranslation } from "@/hooks/useTranslation";
import { type TimeUnit } from "@/supabase/client";

const UNIT_MINUTES: Record<TimeUnit, number> = {
  minutes: 1,
  hours: 60,
  days: 24 * 60,
};

/**
 * The unit a stored duration reads most naturally in: the largest one it
 * divides evenly by. 90 minutes stays minutes, 120 becomes 2 hours.
 */
function unitFor(minutes: number | null | undefined): TimeUnit {
  if (typeof minutes !== "number" || minutes <= 0) return "hours";
  if (minutes % UNIT_MINUTES.days === 0) return "days";
  if (minutes % UNIT_MINUTES.hours === 0) return "hours";
  return "minutes";
}

/**
 * A duration held as a plain number of minutes, entered as an amount and a
 * unit — so "20 minutes" is typed as 20, not as a fraction of an hour.
 */
export default function DurationField<T extends FieldValues>({
  name,
  control,
  label,
  description,
  placeholder,
  disabled,
}: {
  /** Path to a minutes-valued number. */
  name: Path<T>;
  control: Control<T>;
  label: string;
  description?: string;
  /** Shown when empty, in the unit currently selected. */
  placeholder?: string;
  disabled?: boolean;
}) {
  const { translate: t } = useTranslation();

  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => {
        const stored = field.value as number | null | undefined;

        return (
          <DurationInputs
            stored={stored}
            onChange={field.onChange}
            label={label}
            description={description}
            placeholder={placeholder}
            disabled={disabled}
            t={t}
          />
        );
      }}
    />
  );
}

function DurationInputs({
  stored,
  onChange,
  label,
  description,
  placeholder,
  disabled,
  t,
}: {
  stored: number | null | undefined;
  onChange: (value: number | null) => void;
  label: string;
  description?: string;
  placeholder?: string;
  disabled?: boolean;
  t: (key: string) => string;
}) {
  // Seeded from the stored value, then the user's own choice: picking "hours"
  // on an empty field must survive the re-render that follows.
  const [unit, setUnit] = useState<TimeUnit>(() => unitFor(stored));

  const amount = typeof stored === "number" ? stored / UNIT_MINUTES[unit] : "";

  // The number on screen stays put, so the duration follows the unit: 2 hours
  // becomes 2 days, not 0.08.
  const chooseUnit = (next: TimeUnit) => {
    setUnit(next);
    if (typeof amount === "number") onChange(amount * UNIT_MINUTES[next]);
  };

  const units: { value: TimeUnit; label: string }[] = [
    { value: "minutes", label: t("minutes") },
    { value: "hours", label: t("hours") },
    { value: "days", label: t("days") },
  ];

  const items: MenuProps["items"] = units.map((option) => ({
    key: option.value,
    label: option.label,
    onClick: () => chooseUnit(option.value),
  }));

  return (
    <div>
      <div className="label">{label}</div>

      <div className="grid grid-cols-2 gap-[9px] items-end">
        <input
          type="number"
          min={0}
          step="any"
          className="text"
          placeholder={placeholder}
          disabled={disabled}
          value={amount}
          onChange={(e) => {
            const raw = e.target.value;
            onChange(raw === "" ? null : Number(raw) * UNIT_MINUTES[unit]);
          }}
        />

        <Dropdown
          trigger={["click"]}
          disabled={disabled}
          menu={{ items, selectable: true, selectedKeys: [unit] }}
        >
          <button
            type="button"
            disabled={disabled}
            className="flex w-full items-center justify-between gap-[6px] border-b-[2px] border-transparent pb-[2px] text-start text-[16px] text-foreground hover:border-input disabled:cursor-default disabled:text-muted-foreground disabled:hover:border-transparent"
          >
            <span className="truncate">
              {units.find((u) => u.value === unit)?.label}
            </span>
            <ChevronDown className="w-[16px] h-[16px] shrink-0 text-muted-foreground" />
          </button>
        </Dropdown>
      </div>

      {description && (
        <div className="text-muted-foreground text-[14px] mt-[4px]">
          {description}
        </div>
      )}
    </div>
  );
}
