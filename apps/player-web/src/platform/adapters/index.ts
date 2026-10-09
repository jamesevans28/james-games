/**
 * The adapters in use (T10.1). Web by default; `initAdapters()` (called once in
 * main.tsx before the first render) swaps in the native set inside the Capacitor
 * shell. The native module is a separate dynamic import, so the web bundle never
 * loads Capacitor plugins.
 */
import type { Adapters } from "./types";
import { webAdapters } from "./web";

export type * from "./types";

let current: Adapters = webAdapters;

/** True inside the iOS/Android app shell (Capacitor injects window.Capacitor). */
export function isNativeShell(): boolean {
  const cap = (globalThis as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return Boolean(cap?.isNativePlatform?.());
}

export async function initAdapters(): Promise<void> {
  if (!isNativeShell()) return;
  const { createNativeAdapters } = await import("./native");
  current = await createNativeAdapters();
}

/** Live view of the current adapters (read the property each time; it changes once at startup). */
export const adapters: Adapters = {
  get storage() {
    return current.storage;
  },
  get session() {
    return current.session;
  },
  get network() {
    return current.network;
  },
  get share() {
    return current.share;
  },
  get haptics() {
    return current.haptics;
  },
  get app() {
    return current.app;
  },
};

/** Tests swap adapters in and out. */
export function setAdaptersForTests(next: Adapters | null): void {
  current = next ?? webAdapters;
}
