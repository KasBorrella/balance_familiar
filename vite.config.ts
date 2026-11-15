import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath, URL } from "node:url";
const base = process.env.VITE_BASE_PATH || "/";
if (!base.startsWith("/") || !base.endsWith("/"))
  throw new Error("VITE_BASE_PATH debe empezar y terminar con /");
export default defineConfig({
  base,
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "static-csp",
      apply: "build",
      transformIndexHtml() {
        return [
          {
            tag: "meta",
            attrs: {
              "http-equiv": "Content-Security-Policy",
              content:
                "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'",
            },
            injectTo: "head-prepend",
          },
        ];
      },
    },
    VitePWA({
      registerType: "prompt",
      includeAssets: [
        "icon.svg",
        "icon-192.png",
        "icon-512.png",
        "maskable-512.png",
        "offline.html",
        "theme.js",
      ],
      manifest: {
        name: "Balance Familiar",
        short_name: "Balance",
        description: "Ingresos, gastos y ahorro familiar",
        lang: "es-ES",
        theme_color: "#174f49",
        background_color: "#f2f5f1",
        display: "standalone",
        start_url: base,
        scope: base,
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,woff2}"],
        navigateFallback: `${base}index.html`,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          charts: ["recharts"],
          database: ["dexie", "dexie-react-hooks"],
          forms: ["zod", "react-hook-form", "@hookform/resolvers"],
          react: ["react", "react-dom", "react-router-dom"],
        },
      },
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    setupFiles: ["tests/setup.ts"],
  },
});
