/**
 * The backend origin, read once. Production builds refuse to build without
 * VITE_API_BASE_URL (guard in vite/config.prod.mjs), so the localhost default
 * below can only ever apply in development.
 */
const raw = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();

export const API_BASE_URL: string = (raw || (import.meta.env.DEV ? "http://localhost:8787" : "")).replace(/\/+$/, "");
