import {
  Controller,
  type Control,
  type FieldValues,
  type Path,
} from "react-hook-form";
import Switch from "@/components/Switch";

interface SwitchFieldProps<T extends FieldValues> {
  name: Path<T>;
  control: Control<T>;
  label: string;
  // One line under the label explaining what turning it off changes.
  description?: string;
  disabled?: boolean;
}

/**
 * A boolean form field, in the same shape as `SelectField` / `TextAreaField`:
 * the row is the whole control, so tapping the label toggles it.
 */
export default function SwitchField<T extends FieldValues>({
  name,
  control,
  label,
  description,
  disabled,
}: SwitchFieldProps<T>) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <label
          className={`flex items-center gap-[12px] justify-between ${
            disabled ? "" : "cursor-pointer"
          }`}
        >
          <div className="flex flex-col gap-[2px]">
            <div className="text-foreground">{label}</div>
            {description && (
              <div className="text-muted-foreground text-[14px]">
                {description}
              </div>
            )}
          </div>
          <Switch
            checked={!!field.value}
            onCheckedChange={field.onChange}
            disabled={disabled}
            className="shrink-0"
          />
        </label>
      )}
    />
  );
}
