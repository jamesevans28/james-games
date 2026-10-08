/**
 * Capacitor implementations (T10.1). Loaded only inside the iOS/Android shell by
 * initAdapters(), so none of this reaches the web bundle's main chunk.
 *
 * Storage: Preferences is async, but the app (and games via host.best) read storage
 * synchronously, so we load every key into memory before the first render and
 * write through to Preferences in the background.
 */
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { Clipboard } from "@capacitor/clipboard";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { Network } from "@capacitor/network";
import { Preferences } from "@capacitor/preferences";
import { Share } from "@capacitor/share";
import type { Adapters, StorageAdapter } from "./types";

async function preferencesMirror(): Promise<StorageAdapter> {
  const memory = new Map<string, string>();
  const { keys } = await Preferences.keys();
  await Promise.all(
    keys.map(async (key) => {
      const { value } = await Preferences.get({ key });
      if (value !== null) memory.set(key, value);
    }),
  );
  return {
    get: (key) => memory.get(key) ?? null,
    set(key, value) {
      memory.set(key, value);
      void Preferences.set({ key, value });
    },
    remove(key) {
      memory.delete(key);
      void Preferences.remove({ key });
    },
  };
}

function memoryStorage(): StorageAdapter {
  const memory = new Map<string, string>();
  return {
    get: (key) => memory.get(key) ?? null,
    set: (key, value) => void memory.set(key, value),
    remove: (key) => void memory.delete(key),
  };
}

async function copy(text: string): Promise<boolean> {
  try {
    await Clipboard.write({ string: text });
    return true;
  } catch {
    return false;
  }
}

export async function createNativeAdapters(): Promise<Adapters> {
  const storage = await preferencesMirror();
  let online = (await Network.getStatus()).connected;
  const listeners = new Set<(online: boolean) => void>();
  void Network.addListener("networkStatusChange", (status) => {
    online = status.connected;
    for (const l of listeners) l(online);
  });
  const platform = Capacitor.getPlatform() === "android" ? "android" : "ios";

  return {
    storage,
    session: memoryStorage(),
    network: {
      isOnline: () => online,
      onChange(callback) {
        listeners.add(callback);
        return () => listeners.delete(callback);
      },
    },
    share: {
      async share(data) {
        try {
          await Share.share({ title: data.title, text: data.text, url: data.url });
          return "shared";
        } catch {
          // The user closed the sheet, or sharing isn't available.
          return (await copy(data.url)) ? "copied" : "cancelled";
        }
      },
      copy,
    },
    haptics: {
      tap: () => void Haptics.impact({ style: ImpactStyle.Light }),
      success: () => void Haptics.notification({ type: NotificationType.Success }),
      fail: () => void Haptics.notification({ type: NotificationType.Error }),
    },
    app: {
      isNative: true,
      platform,
      openUrl: (url) => void Browser.open({ url }),
    },
  };
}
