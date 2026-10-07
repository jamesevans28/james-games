import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

const phasermsg = () => {
  return {
    name: "phasermsg",
    buildStart() {
      process.stdout.write(`Building for production...\n`);
    },
    buildEnd() {
      const line = "---------------------------------------------------------";
      const msg = `❤️❤️❤️ Tell us about your game! - games@phaser.io ❤️❤️❤️`;
      process.stdout.write(`${line}\n${msg}\n${line}\n`);

      process.stdout.write(`✨ Done ✨\n`);
    },
  };
};

export default defineConfig({
  base: "./",
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      includeAssets: ["favicon.svg", "favicon.png"],
      // Disable update prompts - only update silently in background
      workbox: {
        skipWaiting: false, // Don't auto-activate new SW, let it wait
        clientsClaim: false, // Don't take control immediately
        globPatterns: ["**/*.{js,css,html,ico,png,svg,mp3,ogg,ttf,woff2}"],
        // Avoid duplicate precache entries: manifest icons are already injected,
        // so ignore them in the glob scan to prevent add-to-cache-list conflicts.
        globIgnores: ["**/assets/shared/logo_square.png"],
        // allow slightly larger assets in precache to include updated logo
        maximumFileSizeToCacheInBytes: 3145728, // 3 MiB
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
        name: "flingo.fun - Free Online Games",
        short_name: "flingo",
        description:
          "Play free, kid-friendly browser games instantly! Arcade, puzzle, word games and more - no download required.",
        theme_color: "#A855F7",
        background_color: "#FFFFFF",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        categories: ["games", "entertainment", "kids"],
        lang: "en-US",
        dir: "ltr",
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
        screenshots: [],
        shortcuts: [
          {
            name: "Browse Games",
            short_name: "Games",
            description: "Browse all free games",
            url: "/",
            icons: [{ src: "/assets/shared/logo_square.png", sizes: "96x96" }],
          },
        ],
      },
    }),
    phasermsg(),
  ],
  logLevel: "warning",
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ["phaser"],
        },
      },
    },
    minify: "terser",
    terserOptions: {
      compress: {
        passes: 2,
      },
      mangle: true,
      format: {
        comments: false,
      },
    },
  },
});
