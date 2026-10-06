import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? "/poki/" : "/",
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "poki-icon.svg", "poki-maskable.svg"],
      manifest: {
        name: "Poki",
        short_name: "Poki",
        description: "A private, local-first space for two.",
        theme_color: "#0c0d12",
        background_color: "#0c0d12",
        display: "standalone",
        start_url: process.env.GITHUB_ACTIONS ? "/poki/" : "/",
        scope: process.env.GITHUB_ACTIONS ? "/poki/" : "/",
        icons: [
          {
            src: "poki-icon.svg",
            sizes: "192x192",
            type: "image/svg+xml",
            purpose: "any",
          },
          {
            src: "poki-icon.svg",
            sizes: "512x512",
            type: "image/svg+xml",
            purpose: "any",
          },
          {
            src: "poki-maskable.svg",
            sizes: "512x512",
            type: "image/svg+xml",
            purpose: "maskable",
          },
        ],
      },
    }),
  ],
});
