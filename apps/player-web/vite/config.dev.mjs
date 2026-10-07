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
          // API caching. Workbox serialises these functions into sw.js, so they must not
          // reference anything outside their own body. Only responses that are identical
          // for every viewer may be cached; anything that can vary by the signed-in user
          // (profile, followers, streaks, XP, personalised feed, a user's own rating,
          // "following" leaderboards) must never be. See docs/plan T1.5.
          {
            urlPattern: ({ url, request }) =>
              request.method === "GET" &&
              (url.origin === "https://api.games4james.com" || url.origin === "http://localhost:8787") &&
              (/^\/games\/config(\/[a-z0-9-]+)?$/.test(url.pathname) ||
                url.pathname === "/ratings" ||
                url.pathname === "/ratings/" ||
                (/^\/scores\/[a-z0-9-]+$/.test(url.pathname) && !url.searchParams.has("scope"))),
            handler: "NetworkFirst",
            options: {
              cacheName: "api-public",
              networkTimeoutSeconds: 3,
              cacheableResponse: { statuses: [200] },
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 },
            },
          },
          {
            // Everything else on the API, including every authenticated route: never cached.
            urlPattern: ({ url }) =>
              url.origin === "https://api.games4james.com" || url.origin === "http://localhost:8787",
            handler: "NetworkOnly",
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
