import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig({
  base: "./",
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      devOptions: { enabled: true },
      includeAssets: ["favicon.svg", "favicon.png"],
      workbox: {
        // Don't precache anything in dev mode; explicitly ignore logo to avoid duplicate entries when switching modes
        globPatterns: [],
        globIgnores: ["**/assets/shared/logo_square.png"],
        runtimeCaching: [
          {
            // Same-origin API (if proxied or served under /api)
            urlPattern: ({ url }) =>
              url.origin === self.location.origin && url.pathname.startsWith("/api/"),
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              networkTimeoutSeconds: 3,
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 },
            },
          },
          {
            // External API domain (optional)
            urlPattern: /^https:\/\/api\.flingo\.fun\/.*/,
            handler: "NetworkFirst",
            options: {
              cacheName: "api-external-cache",
              networkTimeoutSeconds: 3,
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 },
            },
          },
          {
            // Cache images aggressively
            urlPattern: ({ request }) => request.destination === "image",
            handler: "CacheFirst",
            options: {
              cacheName: "images",
              expiration: { maxEntries: 200, maxAgeSeconds: 7 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Google Fonts
            urlPattern: /https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*$/,
            handler: "StaleWhileRevalidate",
            options: { cacheName: "google-fonts" },
          },
        ],
      },
      manifest: {
        name: "flingo.fun",
        short_name: "flingo",
        description: "Play free, fast, skill-based games in your browser.",
        theme_color: "#A855F7",
        background_color: "#FFFFFF",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        icons: [
          {
            src: "/assets/shared/logo_square.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/assets/shared/logo_square.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
        ],
      },
    }),
  ],
  server: {
    port: 3000,
  },
});
