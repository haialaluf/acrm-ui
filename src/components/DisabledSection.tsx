import type { ReactNode } from "react";

/**
 * Visually disables a section and shows a tooltip explaining why.
 * When `disabled`, children are dimmed and made non-interactive via
 * `pointer-events-none`; the `description` surfaces as a native tooltip.
 * When not disabled, children render untouched.
 */
export default function DisabledSection({
  disabled,
  description,
  children,
  className,
}: {
  disabled?: boolean;
  description: string;
  children: ReactNode;
  className?: string;
}) {
  if (!disabled) {
    return <>{children}</>;
  }

  return (
    <div className={className} title={description} aria-disabled>
      <div className="pointer-events-none select-none opacity-50">
        {children}
      </div>
    </div>
  );
}
