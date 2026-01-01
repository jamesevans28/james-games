import { useCallback, useEffect, useState } from "react";
import { fetchFollowNotifications } from "../lib/api";
import { useAuth } from "../context/FirebaseAuthProvider";

const LAST_SEEN_KEY = "notifications:lastSeen";

function getNow() {
  if (typeof Date === "undefined") return 0;
  return Date.now();
}

export function getNotificationsLastSeen(): number {
  if (typeof window === "undefined" || !window.localStorage) return 0;
  const raw = window.localStorage.getItem(LAST_SEEN_KEY);
  if (!raw) return 0;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function markNotificationsAsRead(timestamp = getNow()) {
  if (typeof window === "undefined" || !window.localStorage) return;
  window.localStorage.setItem(LAST_SEEN_KEY, String(timestamp));
}

export function useNotificationsIndicator() {
  const { user, initialized } = useAuth();
  const [hasUnread, setHasUnread] = useState(false);
  const [loading, setLoading] = useState(false);

  const checkForUnread = useCallback(async () => {
    // Don't fetch if not authenticated or auth not initialized
    if (!initialized || !user) {
      setHasUnread(false);
      return;
    }

    setLoading(true);
    try {
      const res = await fetchFollowNotifications();
      const lastSeen = getNotificationsLastSeen();
      const anyNew = Array.isArray(res.notifications)
        ? res.notifications.some((n) => {
            const ts = n?.createdAt ? Date.parse(n.createdAt) : 0;
            return Number.isFinite(ts) && ts > lastSeen;
          })
        : false;
      setHasUnread(anyNew);
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn("Failed to refresh notifications", err);
      }
    } finally {
      setLoading(false);
    }
  }, [initialized, user]);

  useEffect(() => {
    // Wait for auth to initialize before checking
    if (!initialized) return;

    let cancelled = false;
    const run = async () => {
      if (cancelled) return;
      await checkForUnread();
    };
    run();
    let interval: number | null = null;
    if (typeof window !== "undefined" && user) {
      interval = window.setInterval(() => {
        void checkForUnread();
      }, 60000);
    }
    return () => {
      cancelled = true;
      if (interval && typeof window !== "undefined") {
        window.clearInterval(interval);
      }
    };
  }, [checkForUnread, initialized, user]);

  const markRead = useCallback(() => {
    markNotificationsAsRead();
    setHasUnread(false);
  }, []);

  return { hasUnread, loading, refreshNotifications: checkForUnread, markRead };
}
