import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  // A GitHub Pages *project* site serves from /<repo-name>/, not the domain
  // root — set at build time (the workflow passes the actual repo name).
  // Any other host (Render static, a custom domain, local dev) just wants "/".
  base: process.env.VITE_BASE_PATH || "/",
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["pastabots-logo.png"],
      manifest: {
        name: "Pastabots Scouting",
        short_name: "Pastabots",
        start_url: ".",
        display: "standalone",
        background_color: "#000000",
        theme_color: "#000000",
        icons: [
          { src: "pastabots-logo.png", sizes: "500x600", type: "image/png" },
          { src: "pastabots-logo.png", sizes: "500x600", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // App shell only — scouting data goes through the IndexedDB outbox,
        // not the service worker cache.
        globPatterns: ["**/*.{js,css,html,svg,png,webp}"],
      },
    }),
  ],
  server: {
    host: true,
    port: 5173,
  },
});
