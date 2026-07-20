import type { RefObject } from "react";
import {
  Bold,
  Italic,
  Strikethrough,
  Code2,
  List,
  ListOrdered,
  Quote,
  Smile,
  Braces,
} from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import EmojiPickerPopover from "./EmojiPickerPopover";
import { surround, linePrefix, insertAtCursor } from "./formatHelpers";

type Target = RefObject<HTMLTextAreaElement | null>;

/** Discoverable WhatsApp formatting: wraps the selection in markers so users
    never have to remember `*bold*`. Also inserts emoji and {{n}} variables.
    `features` toggles which controls appear (header text = emoji + variable). */
export default function FormatToolbar({
  targetRef,
  value,
  setValue,
  onVariable,
  features = {},
  dark,
}: {
  targetRef: Target;
  value: string;
  setValue: (v: string) => void;
  onVariable?: () => void;
  features?: { format?: boolean; emoji?: boolean; variable?: boolean };
  dark?: boolean;
}) {
  const { translate: t } = useTranslation();
  const { format = true, emoji = true, variable = true } = features;
  const el = () => targetRef.current;
  const prevent = (e: React.MouseEvent) => e.preventDefault();

  return (
    <div className="wa-toolbar">
      {format && (
        <div className="fmt-group">
          <button
            type="button"
            className="fmt-btn"
            title={`${t("Negrita")}  (*${t("texto")}*)`}
            onMouseDown={prevent}
            onClick={() => surround(el(), value, setValue, "*")}
          >
            <Bold size={15} />
          </button>
          <button
            type="button"
            className="fmt-btn"
            title={`${t("Cursiva")}  (_${t("texto")}_)`}
            onMouseDown={prevent}
            onClick={() => surround(el(), value, setValue, "_")}
          >
            <Italic size={15} />
          </button>
          <button
            type="button"
            className="fmt-btn"
            title={`${t("Tachado")}  (~${t("texto")}~)`}
            onMouseDown={prevent}
            onClick={() => surround(el(), value, setValue, "~")}
          >
            <Strikethrough size={15} />
          </button>
          <button
            type="button"
            className="fmt-btn"
            title={t("Monoespaciado")}
            onMouseDown={prevent}
            onClick={() => surround(el(), value, setValue, "```")}
          >
            <Code2 size={15} />
          </button>
          <span className="fmt-sep" />
          <button
            type="button"
            className="fmt-btn"
            title={t("Lista con viñetas")}
            onMouseDown={prevent}
            onClick={() =>
              linePrefix(el(), value, setValue, (l) =>
                l.startsWith("- ") ? l.slice(2) : "- " + l,
              )
            }
          >
            <List size={15} />
          </button>
          <button
            type="button"
            className="fmt-btn"
            title={t("Lista numerada")}
            onMouseDown={prevent}
            onClick={() =>
              linePrefix(
                el(),
                value,
                setValue,
                (l, i) => `${i + 1}. ` + l.replace(/^\d+\.\s+/, ""),
              )
            }
          >
            <ListOrdered size={15} />
          </button>
          <button
            type="button"
            className="fmt-btn"
            title={t("Cita")}
            onMouseDown={prevent}
            onClick={() =>
              linePrefix(el(), value, setValue, (l) =>
                l.startsWith("> ") ? l.slice(2) : "> " + l,
              )
            }
          >
            <Quote size={15} />
          </button>
        </div>
      )}

      {(emoji || variable) && format && <span className="fmt-sep" />}

      {emoji && (
        <EmojiPickerPopover
          dark={dark}
          onPick={(em) => insertAtCursor(el(), value, setValue, em, false)}
        >
          <button type="button" className="fmt-btn" title={t("Emoji")}>
            <Smile size={16} />
          </button>
        </EmojiPickerPopover>
      )}

      {variable && (
        <button
          type="button"
          className="fmt-btn wide"
          title={t("Insertar variable")}
          onMouseDown={prevent}
          onClick={onVariable}
        >
          <Braces size={14} />
          {t("Variable")}
        </button>
      )}
    </div>
  );
}
