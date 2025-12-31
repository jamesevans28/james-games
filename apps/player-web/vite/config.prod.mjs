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
          {
            // Completely bypass cache for auth endpoints
            urlPattern: ({ url }) =>
              (url.origin === self.location.origin || url.origin === "https://api.flingo.fun") &&
              (url.pathname.startsWith("/api/auth/") ||
                url.pathname === "/me" ||
                url.pathname === "/api/me"),
            handler: "NetworkOnly", // Never cache auth/user endpoints
          },
          {
            urlPattern: ({ url }) =>
              url.origin === self.location.origin &&
              url.pathname.startsWith("/api/") &&
              !url.pathname.startsWith("/api/auth/") &&
              url.pathname !== "/me", // Already handled above
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              networkTimeoutSeconds: 3,
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 },
            },
          },
          {
            urlPattern: /^https:\/\/api\.flingo\.fun\/.*/,
            handler: "NetworkFirst",
            options: {
              cacheName: "api-external-cache",
              networkTimeoutSeconds: 5,
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 },
            },
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
