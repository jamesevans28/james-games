/**
 * Platform adapters (T10.1): everything that differs between the web and the
 * Capacitor apps goes through these. Web implementations live in web.ts; native
 * ones in native.ts, loaded only inside the app shell.
 */

/** Key-value storage. Synchronous for callers; native keeps a mirror of Preferences. */
export type StorageAdapter = {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
};

export type NetworkAdapter = {
  isOnline(): boolean;
  /** Calls back on every change; returns an unsubscribe function. */
  onChange(callback: (online: boolean) => void): () => void;
};

export type ShareResult = "shared" | "copied" | "cancelled" | "failed";

export type ShareAdapter = {
  /** The system share sheet, or the clipboard when there isn't one. */
  share(data: { title: string; text?: string; url: string }): Promise<ShareResult>;
  copy(text: string): Promise<boolean>;
};

export type HapticsAdapter = { tap(): void; success(): void; fail(): void };

export type AppAdapter = {
  isNative: boolean;
  platform: "web" | "ios" | "android";
  /** Opens an external page (new tab on the web, the in-app browser natively). */
  openUrl(url: string): void;
  /** Keep the screen on while a game runs (Wake Lock on the web, keep-awake natively). */
  keepAwake(on: boolean): void;
  /** The Android hardware back button. Returns an unsubscribe function (no-op on the web). */
  onBackButton(handler: () => void): () => void;
  /** Leave the app (Android only; a no-op elsewhere). */
  exitApp(): void;
};

export type Adapters = {
  storage: StorageAdapter;
  /** Lost when the app is closed (sessionStorage on the web, memory natively). */
  session: StorageAdapter;
  network: NetworkAdapter;
  share: ShareAdapter;
  haptics: HapticsAdapter;
  app: AppAdapter;
};
