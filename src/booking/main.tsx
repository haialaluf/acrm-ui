import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./booking.css";
import App from "./App";
import { detectLanguage, initI18n, isRtl } from "./i18n";

/**
 * Entry point for calendar.delacrm.com — a second Vite build out of this repo
 * (vite.booking.config.ts) so the booking page shares the design tokens and
 * translations without sharing the app's dependencies: no router, no supabase
 * client, no zustand, no react-query.
 */

// Same dark-mode convention as the app's main.tsx.
const darkMode = window.matchMedia("(prefers-color-scheme: dark)");
function applyTheme(e: MediaQueryList | MediaQueryListEvent) {
  document.documentElement.classList.toggle("dark", e.matches);
}
applyTheme(darkMode);
darkMode.addEventListener("change", applyTheme);

initI18n();
const lang = detectLanguage();

// Set before the first paint, so an RTL locale doesn't flip after render. The
// page keeps them in sync from here on — language is switchable in-page.
document.documentElement.dir = isRtl(lang) ? "rtl" : "ltr";
document.documentElement.lang = lang;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App initialLang={lang} />
  </StrictMode>,
);
