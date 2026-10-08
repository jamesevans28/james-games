import { defineConfig, loadEnv, type UserConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import brand from "./src/config/brand.json" with { type: "json" };
import { brandHtml } from "./vite/brandHtml.ts";

/**
 * One config for dev and production (T2.3 merged vite/config.dev.mjs and
 * vite/config.prod.mjs). Differences are keyed on `command`:
 * - production builds refuse to run without VITE_API_BASE_URL;
 * - the service worker only runs in dev when VITE_SW_DEV=1 (it otherwise
 *   caches dev assets and causes stale-code confusion).
 */
export default defineConfig(({ command, mode }): UserConfig => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const isBuild = command === "build";

  // Fail the build, not the users: a production bundle without an API origin would
  // silently call localhost or nothing at all. (CI sets it from repo variables.)
  if (isBuild && !env.VITE_API_BASE_URL) {
    throw new Error(
      "VITE_API_BASE_URL must be set for production builds (see apps/player-web/.env.example).",
    );
  }

  return {
    // Absolute asset URLs work for deep links on the web and for capacitor://localhost (T10.2).
    base: "/",
    logLevel: isBuild ? "warn" : "info",
    server: { port: 3000 },
    plugins: [
      brandHtml(),
      tailwindcss(),
      react(),
      VitePWA({
        registerType: "autoUpdate",
        injectRegister: "auto",
        devOptions: { enabled: env.VITE_SW_DEV === "1" },
        includeAssets: ["brand/logo-mark.svg", "brand/icon-32.png", "brand/icon-180.png"],
        workbox: {
          skipWaiting: false, // let the update prompt decide when to activate
          clientsClaim: false,
          // Dev precaches nothing; production precaches the app shell and game assets.
          globPatterns: isBuild ? ["**/*.{js,css,html,ico,png,svg,mp3,ogg,ttf,woff2}"] : [],
          // Manifest icons and the share image are fetched on demand, not precached.
          globIgnores: [
            "**/brand/icon-512*.png",
            "**/brand/og-*.png",
            "**/brand/screenshot-*",
            "**/static-games/**",
          ],
          maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
          runtimeCaching: [
            // Workbox serialises these functions into sw.js, so they must not reference
            // anything outside their own body. Only responses identical for every viewer
            // may be cached; anything that can vary by the signed-in user must never be.
            // See docs/plan T1.5.
            {
              urlPattern: ({ url, request }) =>
                request.method === "GET" &&
                (url.origin === "https://api.games4james.com" ||
                  url.origin === "http://localhost:8787") &&
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
                url.origin === "https://api.games4james.com" ||
                url.origin === "http://localhost:8787",
              handler: "NetworkOnly",
            },
            {
              urlPattern: ({ request }) => request.destination === "image",
              handler: "CacheFirst",
              options: {
                cacheName: "images",
                expiration: { maxEntries: 200, maxAgeSeconds: 7 * 24 * 60 * 60 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              urlPattern: /https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*$/,
              handler: "StaleWhileRevalidate",
              options: { cacheName: "google-fonts" },
            },
          ],
        },
        manifest: {
          id: "/",
          name: brand.name,
          short_name: brand.name,
          description: brand.description,
          theme_color: brand.themeColor,
          background_color: brand.backgroundColor,
          display: "standalone",
          orientation: "portrait",
          scope: "/",
          start_url: "/",
          categories: ["games", "kids"],
          lang: "en-AU",
          dir: "ltr",
          icons: [
            { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
            { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
            {
              src: "/brand/icon-512-maskable.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
          // Captured in the Browser pane at 375×812 @2x (T3.3). Retake after big UI changes.
          screenshots: [
            {
              src: "/brand/screenshot-home.jpg",
              sizes: "750x1624",
              type: "image/jpeg",
              form_factor: "narrow",
              label: "The games feed",
            },
            {
              src: "/brand/screenshot-games.jpg",
              sizes: "750x1624",
              type: "image/jpeg",
              form_factor: "narrow",
              label: "Every game",
            },
          ],
        },
      }),
    ],
    build: {
      rolldownOptions: {
        output: {
          // Phaser is ~1.2 MB: keep it in its own long-cached chunk.
          codeSplitting: {
            groups: [{ name: "phaser", test: /node_modules[\\/]phaser[\\/]/ }],
          },
        },
      },
    },
  };
});
