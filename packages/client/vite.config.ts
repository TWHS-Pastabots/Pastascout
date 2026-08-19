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
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "FRC Scouting",
        short_name: "Scouting",
        start_url: ".",
        display: "standalone",
        background_color: "#0f172a",
        theme_color: "#0f172a",
        icons: [
          { src: "pwa-192.svg", sizes: "192x192", type: "image/svg+xml" },
          { src: "pwa-512.svg", sizes: "512x512", type: "image/svg+xml" },
        ],
      },
      workbox: {
        // App shell only — scouting data goes through the IndexedDB outbox,
        // not the service worker cache.
        globPatterns: ["**/*.{js,css,html,svg}"],
      },
    }),
  ],
  server: {
    host: true,
    port: 5173,
  },
});
