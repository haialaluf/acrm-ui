import { useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { renderBlocks } from "./renderWhatsAppText";

// WhatsApp collapses long messages (marketing bodies) behind a "Read more".
const COLLAPSE_PX = 250;

export default function ReadMoreText({
  text,
  vars,
}: {
  text: string;
  vars: string[];
}) {
  const { translate: t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [clamp, setClamp] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setClamp(el.scrollHeight > COLLAPSE_PX + 6);
  }, [text, vars]);

  return (
    <div className="wa-textwrap">
      <div
        ref={ref}
        className="wa-body"
        style={{ maxHeight: !expanded && clamp ? COLLAPSE_PX : "none" }}
      >
        {renderBlocks(text, vars)}
      </div>
      {clamp && !expanded && (
        <button
          type="button"
          className="wa-readmore"
          onClick={() => setExpanded(true)}
        >
          {t("Leer más")}
        </button>
      )}
    </div>
  );
}
