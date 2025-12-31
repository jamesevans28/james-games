import { useState, useEffect, useCallback } from "react";

/**
 * Hook to detect online/offline status with event listeners.
 * Returns { isOnline, checkConnection }
 *
 * Note: navigator.onLine can have false positives (reports online when behind captive portal)
 * but accurately reports when definitely offline.
 */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Check initial state
    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Optionally do a real connectivity check
  const checkConnection = useCallback(async (): Promise<boolean> => {
    if (!navigator.onLine) return false;

    // Try a small fetch to verify actual connectivity
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      await fetch("/robots.txt", {
        method: "HEAD",
        cache: "no-store",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return true;
    } catch {
      return false;
    }
  }, []);

  return { isOnline, checkConnection };
}

/**
 * Simple function to check if we're currently online.
 * Can be used outside of React components.
 */
export function isOnline(): boolean {
  return typeof navigator !== "undefined" ? navigator.onLine : true;
}
