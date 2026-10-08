import { useCallback, useState } from "react";
import { STORAGE_KEYS, readStored } from "../utils/storageKeys";
import { useFriendRequests } from "./useFriends";

/** When the player last opened Notifications (ms since epoch), 0 if never. */
export function getNotificationsLastSeen(): number {
  const parsed = Number(readStored("notificationsSeenAt"));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function markNotificationsAsRead(timestamp = Date.now()) {
  try {
    localStorage.setItem(STORAGE_KEYS.notificationsSeenAt, String(timestamp));
  } catch {
    // Storage blocked: the dot just comes back next time.
  }
}

/** True when a request is newer than the last time Notifications was opened. */
export function hasNewRequests(requests: Array<{ createdAt: string }>, lastSeen: number): boolean {
  return requests.some((r) => {
    const ts = Date.parse(r.createdAt);
    return Number.isFinite(ts) && ts > lastSeen;
  });
}

/**
 * The header's notifications dot: lit by friend requests you haven't seen yet (T7.6).
 * No polling: requests refresh when the app regains focus and after friend actions.
 */
export function useNotificationsIndicator() {
  const { data, isFetching, refetch } = useFriendRequests();
  const [lastSeen, setLastSeen] = useState(getNotificationsLastSeen);

  const markRead = useCallback(() => {
    const now = Date.now();
    markNotificationsAsRead(now);
    setLastSeen(now);
  }, []);

  return {
    hasUnread: hasNewRequests(data?.incoming ?? [], lastSeen),
    loading: isFetching,
    refreshNotifications: refetch,
    markRead,
  };
}
