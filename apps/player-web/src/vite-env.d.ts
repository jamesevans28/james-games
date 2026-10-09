/// <reference types="vite/client" />

// Every VITE_ variable the app reads. Declaring them stops `import.meta.env.X`
// from being `any` (vite/client types unknown keys as any).
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_BUILD_NUMBER?: string;
  readonly VITE_ANALYTICS_ID?: string;
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
  readonly VITE_FIREBASE_MEASUREMENT_ID?: string;
  readonly VITE_GIT_SHA?: string;
  readonly VITE_APP_VERSION?: string;
  /** Local stack only: the Firebase Auth emulator URL. */
  readonly VITE_FIREBASE_AUTH_EMULATOR_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
