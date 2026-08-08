import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

type Props = {
  /** Text written to the clipboard. */
  value: string;
  /** Tooltip / accessible label. Defaults to "Copy". */
  title?: string;
  className?: string;
};

/**
 * Copy-to-clipboard icon button with a 2s confirmation tick.
 *
 * Extracted from the three onboarding-link pages, which had this inlined
 * verbatim; the DNS records table needs a dozen of them.
 */
export default function CopyButton({ value, title, className }: Props) {
  const { translate: t } = useTranslation();
  const [copied, setCopied] = useState(false);
  // Held so an unmount mid-countdown doesn't setState on a dead component, and
  // so rapid clicks restart the window instead of stacking timers.
  const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timeout.current), []);

  const copy = () => {
    void navigator.clipboard.writeText(value);
    setCopied(true);
    clearTimeout(timeout.current);
    timeout.current = setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      className={`p-[8px] hover:bg-muted rounded-full shrink-0 ${className ?? ""}`}
      title={title ?? t("Copy")}
      onClick={copy}
    >
      {copied ? (
        <Check className="w-[20px] h-[20px] text-primary" />
      ) : (
        <Copy className="w-[20px] h-[20px] text-muted-foreground" />
      )}
    </button>
  );
}
