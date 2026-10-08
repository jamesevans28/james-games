import type { Adapters, StorageAdapter } from "./types";

/** Wraps a Web Storage area. Never throws: storage can be missing, blocked or full. */
export function webStorage(area: () => Storage | undefined): StorageAdapter {
  return {
    get(key) {
      try {
        return area()?.getItem(key) ?? null;
      } catch {
        return null;
      }
    },
    set(key, value) {
      try {
        area()?.setItem(key, value);
      } catch {
        // Full or blocked: the value just isn't kept.
      }
    },
    remove(key) {
      try {
        area()?.removeItem(key);
      } catch {
        // ignore
      }
    },
  };
}

const local = () => (typeof localStorage === "undefined" ? undefined : localStorage);
const session = () => (typeof sessionStorage === "undefined" ? undefined : sessionStorage);

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export const webAdapters: Adapters = {
  storage: webStorage(local),
  session: webStorage(session),
  network: {
    isOnline: () => (typeof navigator === "undefined" ? true : navigator.onLine),
    onChange(callback) {
      const on = () => callback(true);
      const off = () => callback(false);
      window.addEventListener("online", on);
      window.addEventListener("offline", off);
      return () => {
        window.removeEventListener("online", on);
        window.removeEventListener("offline", off);
      };
    },
  },
  share: {
    async share(data) {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        try {
          await navigator.share(data);
          return "shared";
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") return "cancelled";
        }
      }
      return (await copy(data.url)) ? "copied" : "failed";
    },
    copy,
  },
  haptics: {
    tap: () => vibrate(10),
    success: () => vibrate([20, 40, 20]),
    fail: () => vibrate(60),
  },
  app: {
    isNative: false,
    platform: "web",
    openUrl(url) {
      window.open(url, "_blank", "noopener,noreferrer");
    },
  },
};

function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Not supported (iOS Safari): silently skip.
  }
}
