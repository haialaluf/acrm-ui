import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import "./global.css";
import { ConfigProvider } from "antd";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { TickProvider } from "./contexts/useTick";
import { WhatsAppIntegrationProvider } from "./contexts/WhatsAppIntegrationContext";
import { loadTranslations } from "./i18n/translations";
import useBoundStore from "./stores/useBoundStore";
import { detectDefaultLanguage, isRtl, type Language } from "./stores/uiSlice";

// Import the generated route tree
import { routeTree } from "./routeTree.gen";

// Create a new router instance
const router = createRouter({ routeTree });

// Register the router instance for type safety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const queryClient = new QueryClient();

// Dark mode detection
const darkModeMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

function updateTheme(e: MediaQueryListEvent | MediaQueryList) {
  if (e.matches) {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}

// Initial check
updateTheme(darkModeMediaQuery);

// Listen for changes
darkModeMediaQuery.addEventListener("change", updateTheme);

// Preload translations before rendering
function detectLanguage(): Language {
  try {
    const stored = JSON.parse(localStorage.getItem("app-state") || "{}");
    if (stored?.state?.ui?.language) return stored.state.ui.language;
  } catch {
    /* ignore */
  }

  return detectDefaultLanguage();
}

// Keep the document direction in sync with the active language (Hebrew is RTL)
// and drive Ant Design's layout direction via ConfigProvider.
function applyDirection(lang: Language) {
  document.documentElement.dir = isRtl(lang) ? "rtl" : "ltr";
  document.documentElement.lang = lang;
}

function App() {
  const language = useBoundStore((state) => state.ui.language);

  useEffect(() => {
    applyDirection(language);
  }, [language]);

  return (
    <ConfigProvider direction={isRtl(language) ? "rtl" : "ltr"}>
      <RouterProvider router={router} />
    </ConfigProvider>
  );
}

const initialLang = detectLanguage();
await loadTranslations(initialLang);
applyDirection(initialLang); // set before first paint to avoid a layout flash

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <TickProvider>
        <WhatsAppIntegrationProvider>
          <App />
        </WhatsAppIntegrationProvider>
      </TickProvider>
    </QueryClientProvider>
  </StrictMode>,
);
