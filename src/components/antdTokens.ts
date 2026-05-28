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
