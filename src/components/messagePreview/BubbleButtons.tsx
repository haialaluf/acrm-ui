import { List } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import {
  ButtonKindIcon,
  type PreviewButton,
} from "@/components/templateButtons";

const DEFAULT_LABEL: Record<PreviewButton["kind"], string> = {
  QR: "Respuesta rápida",
  URL: "Visitar sitio web",
  PHONE: "Llamar",
  COPY: "Copiar código",
};

/** Buttons attached under the bubble. WhatsApp shows up to 3; with more it
    shows the first 2 and a "See all options" row that opens the rest. */
export default function BubbleButtons({
  buttons,
  showIcons,
}: {
  buttons: PreviewButton[];
  showIcons: boolean;
}) {
  const { translate: t } = useTranslation();
  if (!buttons.length) return null;

  let shown = buttons;
  let overflow = false;
  if (buttons.length > 3) {
    shown = buttons.slice(0, 2);
    overflow = true;
  }

  return (
    <div className="wa-actions">
      {shown.map((b, i) => (
        <div key={i} className="wa-act">
          {showIcons && (
            <ButtonKindIcon kind={b.kind} className="w-[15px] h-[15px]" />
          )}
          <span>{b.text || t(DEFAULT_LABEL[b.kind])}</span>
        </div>
      ))}
      {overflow && (
        <div className="wa-act">
          <List className="w-[15px] h-[15px]" />
          <span>{t("Ver todas las opciones")}</span>
        </div>
      )}
    </div>
  );
}
