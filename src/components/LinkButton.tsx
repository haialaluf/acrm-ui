import { Link } from "@tanstack/react-router";
import { type ReactNode } from "react";

interface LinkButtonProps {
  to: string;
  title: string;
  children: ReactNode;
  isActive?: boolean;
  className?: string; // For margin tops etc
}

export function LinkButton({
  to,
  title,
  children,
  isActive,
  className = "",
}: LinkButtonProps) {
  // Match the design's nav rail: inactive icons read muted, the active one is
  // tinted with the primary (green) colour and a soft primary background pill.
  const stateClasses = isActive
    ? "bg-primary/10 text-primary hover:bg-primary/20"
    : "text-muted-foreground hover:bg-muted";

  return (
    <Link
      to={to}
      hash={(prevHash: string | undefined) => prevHash!}
      title={title}
    >
      <div className={`p-[8px] rounded-full ${stateClasses} ${className}`}>
        {children}
      </div>
    </Link>
  );
}
