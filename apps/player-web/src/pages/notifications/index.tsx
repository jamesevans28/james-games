import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { acceptFriendRequest, declineFriendRequest } from "../../lib/api";
import { OfflineBanner } from "../../components/OfflineBanner";
import { usePresenceReporter } from "../../hooks/usePresenceReporter";
import { markNotificationsAsRead } from "../../hooks/useNotificationsIndicator";
import { useFriendAction, useFriendRequests } from "../../hooks/useFriends";
import { friendErrorMessage } from "../../utils/friends";
import { PlayerRow } from "../followers/PlayerRow";

function timeAgo(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "just now";
  const minutes = Math.round((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

/** Notifications (T7.6): friend requests waiting for your yes. */
export default function NotificationsPage() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useFriendRequests();
  const { run, busy } = useFriendAction();
  const [actionError, setActionError] = useState<string | null>(null);

  usePresenceReporter({ status: "home" });

  // Opening the page counts as seeing every request on it.
  useEffect(() => {
    if (data) markNotificationsAsRead();
  }, [data]);

  const act = async (action: () => Promise<unknown>) => {
    setActionError(null);
    try {
      await run(action);
    } catch (err) {
      setActionError(friendErrorMessage(err));
    }
  };

  const incoming = data?.incoming ?? [];

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          className="min-h-11 text-sm text-ink-2 hover:text-brand font-medium"
          onClick={() => navigate(-1)}
        >
          Back
        </button>
        <h1 className="text-2xl font-extrabold text-ink">Notifications</h1>
        <div className="w-10" />
      </div>
      <OfflineBanner />
      {isLoading && <p className="text-ink-2">Loading…</p>}
      {error && <p className="text-base text-ink-2">{friendErrorMessage(error)}</p>}
      <p className="text-sm font-medium text-grape empty:hidden" aria-live="polite">
        {actionError}
      </p>
      {data && incoming.length === 0 && (
        <p className="text-base text-ink-2">
          No friend requests right now.{" "}
          <Link to="/followers" className="font-bold text-brand hover:underline">
            Share your friend code
          </Link>{" "}
          to add friends!
        </p>
      )}
      {incoming.map((r) => (
        <PlayerRow
          key={r.userId}
          player={r}
          detail={`wants to be friends · ${timeAgo(r.createdAt)}`}
        >
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-primary min-h-11"
              disabled={busy}
              onClick={() => void act(() => acceptFriendRequest(r.userId))}
            >
              Yes!
            </button>
            <button
              type="button"
              className="btn btn-outline min-h-11"
              disabled={busy}
              onClick={() => void act(() => declineFriendRequest(r.userId))}
            >
              Not now
            </button>
          </div>
        </PlayerRow>
      ))}
    </div>
  );
}
