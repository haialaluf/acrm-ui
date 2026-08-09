import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

/**
 * Third build out of this repo: the public email opt-out page at
 * unsubscribe.delacrm.com. Same arrangement as vite.booking.config.ts — same
 * source tree (so it shares global.css tokens and the locale JSON), separate
 * entry and output.
 *
 * Note `publicDir` — NOT the app's `public/`, which holds the CNAME for
 * app.delacrm.com. Copying that into this build would hand Cloudflare Pages a
 * file claiming the app's domain.
 *
 * No tanstack-router plugin: the whole route is `location.pathname`.
 */
export default defineConfig({
  root: "unsubscribe",
  publicDir: "public",
  build: {
    outDir: "../dist-unsubscribe",
    emptyOutDir: true,
  },
  plugins: [
    react({
      babel: {
        plugins: [["babel-plugin-react-compiler"]],
      },
    }),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
