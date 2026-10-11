/// <reference types="vite/client" />

// Every VITE_ variable the app reads. Declaring them stops `import.meta.env.X`
// from being `any` (vite/client types unknown keys as any).
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_BUILD_NUMBER?: string;
  readonly VITE_ANALYTICS_ID?: string;
  /** Supabase Auth (Phase 14): the project URL and its publishable (sb_publishable_…) key. */
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_GIT_SHA?: string;
  readonly VITE_APP_VERSION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
