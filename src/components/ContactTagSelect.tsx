import { ConfigProvider, Select } from "antd";
import { useTranslation } from "@/hooks/useTranslation";
import { useContactTags } from "@/queries/useContactTags";

// Theme the Ant Design tags Select to match the underlined `.text` inputs and
// the app's color tokens (works in light & dark). The `underlined` variant
// reads colorBorder / hoverBorderColor / activeBorderColor for its bottom rule,
// so we map those to transparent → `input` → `primary` like the native inputs.
// The dropdown tokens keep the popup readable on the app's surfaces. Flush-left
// alignment with the sibling inputs lives in `.text-select` (see global.css).
const tagSelectTheme = {
  components: {
    Select: {
      // Field
      colorBorder: "transparent",
      hoverBorderColor: "var(--input)",
      activeBorderColor: "var(--primary)",
      colorBgContainer: "transparent",
      colorText: "var(--foreground)",
      colorTextPlaceholder: "var(--muted-foreground)",
      fontSize: 16,
      multipleItemBg: "var(--secondary)",
      // Dropdown popup
      colorBgElevated: "var(--popover)",
      optionActiveBg: "var(--accent)",
      optionSelectedBg: "var(--accent)",
      optionSelectedColor: "var(--accent-foreground)",
    },
  },
};

interface ContactTagSelectProps {
  value?: string[] | null;
  onChange?: (value: string[]) => void;
  onBlur?: () => void;
}

/**
 * Tag picker for contact forms: a free-entry (tags mode) Ant Design Select that
 * suggests every tag already used across the org's contacts (via useContactTags)
 * and is themed to match the underlined `.text` inputs. Controlled — wire it up
 * with react-hook-form's <Controller>.
 */
export default function ContactTagSelect({
  value,
  onChange,
  onBlur,
}: ContactTagSelectProps) {
  const { translate: t } = useTranslation();
  const { data: allTags } = useContactTags();

  return (
    <ConfigProvider theme={tagSelectTheme}>
      <Select
        mode="tags"
        variant="underlined"
        className="text-select"
        style={{ width: "100%" }}
        value={value ?? []}
        onChange={onChange}
        onBlur={onBlur}
        options={allTags.map((tag) => ({ label: tag, value: tag }))}
        placeholder={t("Agregar etiquetas")}
        tokenSeparators={[","]}
        notFoundContent={null}
      />
    </ConfigProvider>
  );
}
