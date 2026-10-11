import type { CapacitorConfig } from "@capacitor/cli";
import brand from "./src/config/brand.json";

/**
 * The iOS and Android apps wrap the same web build (Phase 10). Build the web app
 * first (`npm run web:build`), then `npm run cap:sync -w apps/player-web`.
 */
const config: CapacitorConfig = {
  appId: "com.games4james.app",
  appName: brand.name,
  webDir: "dist",
  server: {
    // https://localhost on Android, capacitor://localhost on iOS: both are secure contexts.
    androidScheme: "https",
  },
  ios: {
    contentInset: "always",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 600,
      backgroundColor: brand.backgroundColor,
      showSpinner: false,
    },
    StatusBar: {
      style: "LIGHT",
      backgroundColor: brand.backgroundColor,
    },
  },
};

export default config;
