import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export default function OnboardingHint({
  icon,
  title,
  description,
  to,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  to: string;
}) {
  return (
    <div className="flex max-w-[360px] flex-col items-center gap-[16px] px-[16px] text-center">
      {/* Styled on an inner div: antd's unlayered `a` reset clears a link's
          own background, overriding the Tailwind utilities. */}
      <Link to={to} className="mb-[8px]">
        <div className="flex h-[96px] w-[96px] items-center justify-center rounded-2xl bg-background text-foreground transition-colors hover:bg-background/60">
          {icon}
        </div>
      </Link>
      <p className="text-[20px] font-bold text-foreground">{title}</p>
      <p className="text-[16px] leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
  );
}
