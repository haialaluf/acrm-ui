/* Shared Ant Design component tokens that map antd's palette onto the app's
   CSS variables. Import these into per-feature `ConfigProvider` themes instead
   of duplicating the token map at each call site. */

export const datePickerTokens = {
  colorBorder: "var(--border)",
  hoverBorderColor: "var(--input)",
  activeBorderColor: "var(--primary)",
  colorBgContainer: "var(--background)",
  colorText: "var(--foreground)",
  colorTextPlaceholder: "var(--muted-foreground)",
  colorBgElevated: "var(--popover)",
  cellHoverBg: "var(--accent)",
  cellActiveWithRangeBg: "oklch(from var(--primary) l c h / 0.10)",
  borderRadius: 10,
};

// TimePicker is built on DatePicker in antd and shares its token shape.
export const timePickerTokens = datePickerTokens;

export const inputTokens = {
  colorBorder: "var(--border)",
  hoverBorderColor: "var(--input)",
  activeBorderColor: "var(--primary)",
  colorBgContainer: "var(--card)",
  colorText: "var(--foreground)",
  colorTextPlaceholder: "var(--muted-foreground)",
  activeShadow: "none",
  borderRadius: 10,
};

export const selectTokens = {
  colorBorder: "var(--border)",
  hoverBorderColor: "var(--input)",
  activeBorderColor: "var(--primary)",
  colorBgContainer: "var(--card)",
  colorText: "var(--foreground)",
  colorTextPlaceholder: "var(--muted-foreground)",
  colorBgElevated: "var(--popover)",
  optionSelectedBg: "var(--accent)",
  optionActiveBg: "var(--accent)",
  borderRadius: 10,
};

export const modalTokens = {
  contentBg: "var(--popover)",
  headerBg: "var(--popover)",
  titleColor: "var(--foreground)",
  colorText: "var(--foreground)",
  borderRadiusLG: 16,
};
