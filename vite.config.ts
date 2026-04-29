/// <reference types="vitest" />
import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

const base = process.env.VITE_BASE_PATH || "/";
const enablePwa = process.env.VITE_ENABLE_PWA === "true";

export default defineConfig({
  base,
  plugins: [
    preact(),
    tailwindcss(),
    VitePWA({
      disabled: !enablePwa,
      registerType: "prompt",
      injectRegister: false,
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "Voronoi Viewer",
        short_name: "Voronoi",
        description: "Interactive animated Voronoi diagram viewer.",
        theme_color: "#111111",
        background_color: "#111111",
        display: "standalone",
        start_url: base,
        scope: base,
        icons: [
          {
            src: `${base.replace(/\/$/, "")}/pwa-192.png`,
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: `${base.replace(/\/$/, "")}/pwa-512.png`,
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: `${base.replace(/\/$/, "")}/pwa-512-maskable.png`,
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,webmanifest}"],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  worker: {
    format: "es",
  },
  build: {
    sourcemap: true,
  },
});
