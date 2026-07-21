import { useRef } from "react";
import { ConfigProvider, Segmented } from "antd";
import { Ban, Type, Image as ImageIcon, Video, FileText } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import type { HeaderType } from "@/components/templateEditorTypes";
import FormatToolbar from "./FormatToolbar";
import MediaDropzone from "./MediaDropzone";
import { insertAtCursor } from "./formatHelpers";

const segmentedTheme = {
  components: {
    Segmented: {
      trackBg: "var(--muted)",
      itemColor: "var(--muted-foreground)",
      itemHoverColor: "var(--foreground)",
      itemSelectedBg: "var(--background)",
      itemSelectedColor: "var(--primary)",
    },
  },
};

const TYPE_ICON: Record<HeaderType, typeof Ban> = {
  NONE: Ban,
  TEXT: Type,
  IMAGE: ImageIcon,
  VIDEO: Video,
  DOCUMENT: FileText,
};

/** Header type selector (None / Text / Image / Video / Document) plus the
    matching content editor: a formattable text line, or a preview-only media
    dropzone. */
export default function HeaderTypeField({
  headerType,
  onHeaderType,
  headerText,
  onHeaderText,
  headerVariable,
  onHeaderVariable,
  mediaUrl,
  mediaName,
  orgId,
  onMedia,
  onClearMedia,
  dark,
}: {
  headerType: HeaderType;
  onHeaderType: (t: HeaderType) => void;
  headerText: string;
  onHeaderText: (v: string) => void;
  headerVariable: string;
  onHeaderVariable: (v: string) => void;
  mediaUrl: string;
  mediaName: string;
  orgId?: string;
  onMedia: (url: string, name: string) => void;
  onClearMedia: () => void;
  dark?: boolean;
}) {
  const { translate: t } = useTranslation();
  const headerRef = useRef<HTMLTextAreaElement | null>(null);

  const options: { value: HeaderType; label: string }[] = [
    { value: "NONE", label: t("Ninguno") },
    { value: "TEXT", label: t("Texto") },
    { value: "IMAGE", label: t("Imagen") },
    { value: "VIDEO", label: t("Video") },
    { value: "DOCUMENT", label: t("Documento") },
  ];

  const headerHasVar = headerType === "TEXT" && headerText.includes("{{1}}");

  return (
    <div className="flex flex-col">
      <div className="label !mb-[8px]">
        {t("Encabezado")} ({t("opcional")})
      </div>

      <ConfigProvider theme={segmentedTheme}>
        <Segmented<HeaderType>
          block
          value={headerType}
          onChange={(v) => onHeaderType(v)}
          options={options.map((o) => {
            const Icon = TYPE_ICON[o.value];
            return {
              value: o.value,
              label: (
                <span className="inline-flex items-center gap-[6px] py-[2px]">
                  <Icon size={15} />
                  <span className="text-[13px]">{o.label}</span>
                </span>
              ),
            };
          })}
        />
      </ConfigProvider>

      <div className="hint mt-[8px]">
        {t(
          "El encabezado va arriba de todo. Llamá la atención con una imagen, o poné un título corto.",
        )}
      </div>

      {headerType === "TEXT" && (
        <div className="mt-[12px] flex flex-col">
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] text-muted-foreground mb-[2px]">
              {t("Texto del título")}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {headerText.length}/60
            </span>
          </div>
          <textarea
            ref={headerRef}
            className="header-text-area"
            rows={1}
            maxLength={60}
            dir="auto"
            placeholder={t("Ej.: Oferta para {{1}}")}
            value={headerText}
            onChange={(e) => onHeaderText(e.target.value.replace(/\n/g, ""))}
          />
          <FormatToolbar
            targetRef={headerRef}
            value={headerText}
            setValue={onHeaderText}
            dark={dark}
            features={{ format: false, emoji: true, variable: !headerHasVar }}
            onVariable={() => {
              if (!headerText.includes("{{1}}"))
                insertAtCursor(
                  headerRef.current,
                  headerText,
                  onHeaderText,
                  "{{1}}",
                  true,
                );
            }}
          />
          {headerHasVar && (
            <div className="mt-[10px] flex flex-col">
              <span className="text-[11px] text-muted-foreground mb-[2px]">
                {t("Ejemplo para")} {"{{1}}"}
              </span>
              <input
                className="text"
                placeholder={t("Ej.: Dana")}
                value={headerVariable}
                onChange={(e) => onHeaderVariable(e.target.value)}
              />
            </div>
          )}
        </div>
      )}

      {(headerType === "IMAGE" ||
        headerType === "VIDEO" ||
        headerType === "DOCUMENT") && (
        <div className="mt-[12px]">
          <MediaDropzone
            type={headerType}
            url={mediaUrl}
            name={mediaName}
            orgId={orgId}
            onFile={onMedia}
            onClear={onClearMedia}
          />
        </div>
      )}
    </div>
  );
}
