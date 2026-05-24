import { ConfigProvider, Select } from "antd";
import { useContactTags } from "@/queries/useContactTags";
import { useTranslation } from "@/hooks/useTranslation";

// Theme the Ant Design Select to match the underlined `.text` inputs and the
// app's color tokens (works in light & dark). The `underlined` variant reads
// colorBorder / hoverBorderColor / activeBorderColor for its bottom rule, so we
// map those to transparent → `input` → `primary` like the native inputs. The
// dropdown tokens keep the popup readable on the app's surfaces. Flush-left
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

interface TagFilterProps {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Multi-select to filter by contact tags. Options come from `useContactTags`
 * (the unique set of tags across the org's contacts) and the built-in search
 * box filters that dropdown by text. Renders nothing when no tags exist.
 */
export default function TagFilter({
  value,
  onChange,
  placeholder,
  className,
}: TagFilterProps) {
  const { translate: t } = useTranslation();
  const { data: tags } = useContactTags();

  if (!tags.length) return null;

  return (
    <div className={className ?? "px-[20px] pb-[12px]"}>
      <ConfigProvider theme={tagSelectTheme}>
        <Select
          mode="multiple"
          variant="underlined"
          className="text-select"
          allowClear
          showSearch
          optionFilterProp="label"
          style={{ width: "100%" }}
          value={value}
          onChange={onChange}
          options={tags.map((tag) => ({ label: tag, value: tag }))}
          placeholder={placeholder ?? t("Filtrar por etiquetas")}
          maxTagCount="responsive"
        />
      </ConfigProvider>
    </div>
  );
}
