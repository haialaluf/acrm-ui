import { type InputHTMLAttributes, forwardRef } from "react";

interface SwitchProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  /** Track colour while on. `warning` is for something that is switched on but
   *  deliberately quiet for now, which is not the same as being off. */
  tone?: "primary" | "warning";
}

const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  (
    {
      className,
      checked,
      onCheckedChange,
      disabled,
      onChange,
      tone = "primary",
      ...props
    },
    ref,
  ) => {
    return (
      <label className={`relative inline-flex items-center ${className || ""}`}>
        <input
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          onChange={(e) => {
            onChange?.(e);
            onCheckedChange?.(e.target.checked);
          }}
          disabled={disabled}
          ref={ref}
          {...props}
        />
        <div
          className={`
            w-[36px] h-[20px] 
            bg-muted-foreground
            peer-focus:outline-none 
            rounded-full peer 
            peer-checked:after:translate-x-full 
            rtl:peer-checked:after:-translate-x-full 
            after:content-[''] 
            after:absolute 
            after:top-[2px] 
            after:start-[2px] 
            after:bg-primary-foreground
            after:rounded-full 
            after:h-[16px] 
            after:w-[16px] 
            after:transition-all 
            ${tone === "warning" ? "peer-checked:bg-warning" : "peer-checked:bg-primary"}
            cursor-pointer
            ${disabled ? "opacity-50 cursor-not-allowed" : ""}
          `}
        ></div>
      </label>
    );
  },
);

Switch.displayName = "Switch";

export default Switch;
