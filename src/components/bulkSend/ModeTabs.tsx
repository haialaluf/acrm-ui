import { Tag, Users } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { type RecipientMode } from "./types";

/** Two-tab pill row toggling between "Contactos" and "Etiquetas" recipient
 *  pickers. */
export default function ModeTabs({
  mode,
  onChange,
}: {
  mode: RecipientMode;
  onChange: (m: RecipientMode) => void;
}) {
  const { translate: t } = useTranslation();
  const tabs: { id: RecipientMode; label: string; icon: typeof Users }[] = [
    { id: "people", label: t("Contactos"), icon: Users },
    { id: "tags", label: t("Etiquetas"), icon: Tag },
  ];
  return (
    <div className="flex gap-[6px]">
      {tabs.map(({ id, label, icon: Icon }) => {
        const active = mode === id;
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            className="flex-1 flex items-center gap-[6px] justify-center px-[12px] py-[7px] rounded-full text-[13px] transition-all"
            style={{
              background: active ? "oklch(from var(--primary) l c h / 0.10)" : "var(--background)",
              border: `1px solid ${active ? "var(--primary)" : "var(--border)"}`,
              color: active ? "var(--primary)" : "var(--foreground)",
            }}
          >
            <Icon className="w-[14px] h-[14px]" />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
