import type { StudioEditorOptions } from "./studioTypes";

/**
 * Dress the vendor builder in acrm's palette.
 *
 * The Studio panels render in the main document (only the email canvas is an
 * iframe), so `var(--…)` resolves against the same custom properties Tailwind
 * reads in global.css — which means light/dark follows the app for free, with
 * no second palette to keep in step. Anything inside the canvas is the *email's*
 * styling and deliberately untouched here.
 */
export const studioTheme: NonNullable<StudioEditorOptions["customTheme"]> = {
  default: {
    colors: {
      global: {
        // background3 is the panel/dialog ground, background2 separates a
        // section from it, background1 is the topmost layer (tabs).
        background1: "var(--sidebar)",
        background2: "var(--muted)",
        background3: "var(--background)",
        backgroundHover: "var(--accent)",
        text: "var(--foreground)",
        border: "var(--border)",
        focus: "var(--ring)",
        placeholder: "var(--muted-foreground)",
      },
      primary: {
        background1: "var(--primary)",
        background2: "var(--primary)",
        background3: "var(--primary)",
        backgroundHover: "var(--primary)",
        text: "var(--primary-foreground)",
      },
      component: {
        background1: "var(--primary)",
        background2: "var(--primary)",
        background3: "var(--primary)",
        backgroundHover: "var(--accent)",
        text: "var(--primary-foreground)",
      },
    },
  },
};
