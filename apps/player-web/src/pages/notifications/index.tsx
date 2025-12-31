import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchFollowNotifications, FollowNotification } from "../../lib/api";
import { ProfileAvatar } from "../../components/profile";
import { usePresenceReporter } from "../../hooks/usePresenceReporter";
import { markNotificationsAsRead } from "../../hooks/useNotificationsIndicator";
import { useOnlineStatus } from "../../hooks/useOnlineStatus";
import { OfflineBanner } from "../../components/OfflineBanner";

function timeAgo(iso: string) {
  if (!iso) return "just now";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "just now";
  const diff = Date.now() - date.getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<FollowNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { isOnline } = useOnlineStatus();

  usePresenceReporter({ status: "home", enabled: true });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);

      // Check if offline
      if (!navigator.onLine) {
        if (!cancelled) {
          setError("You're offline. Connect to view notifications.");
          setLoading(false);
        }
        return;
      }

      try {
        const res = await fetchFollowNotifications();
        if (!cancelled) {
          setNotifications(res.notifications || []);
          markNotificationsAsRead();
        }
      } catch (err: any) {
        if (!cancelled) {
          if (!navigator.onLine) {
            setError("You're offline. Connect to view notifications.");
          } else {
            setError(err?.message || "Failed to load notifications");
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    let interval: number | null = null;
    if (typeof window !== "undefined") {
      interval = window.setInterval(load, 60000);
    }
    return () => {
      cancelled = true;
      if (interval && typeof window !== "undefined") {
        window.clearInterval(interval);
      }
    };
  }, [isOnline]);

  return (
    <div className="max-w-xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          className="text-sm text-gray-600 hover:text-black"
          onClick={() => navigate(-1)}
        >
          Back
        </button>
        <h1 className="text-2xl font-extrabold text-black">Notifications</h1>
        <div className="w-10" />
      </div>
      {!isOnline && <OfflineBanner className="mb-4" />}
      {loading && <div className="text-gray-600">Loading…</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}
      {!loading && !error && notifications.length === 0 && (
        <p className="text-sm text-gray-600">
          No notifications yet. Share your follow code to get started!
        </p>
      )}
      <ul className="mt-4 space-y-3">
        {notifications.map((notification) => (
          <li
            key={`${notification.userId}-${notification.createdAt}`}
            className="flex items-center gap-3 border border-gray-200 rounded-xl p-3 bg-white cursor-pointer hover:border-black"
            onClick={() => navigate(`/profile/${notification.userId}`)}
          >
            <ProfileAvatar user={{ avatar: notification.avatar ?? 1 }} size={48} />
            <div className="flex-1">
              <p className="text-sm text-black">
                <span className="font-semibold">{notification.screenName ?? "Player"}</span>{" "}
                followed you
              </p>
              <p className="text-xs text-gray-500">{timeAgo(notification.createdAt)}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
