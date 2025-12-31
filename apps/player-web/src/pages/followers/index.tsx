import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  fetchFollowersSummary,
  followUserApi,
  unfollowUserApi,
  FollowersSummary,
  PresenceStatus,
} from "../../lib/api";
import { games } from "../../games";
import { ProfileAvatar } from "../../components/profile";
import { usePresenceReporter } from "../../hooks/usePresenceReporter";
import { useAuth } from "../../context/FirebaseAuthProvider";
import ShareFollowCodeCard from "../../components/ShareFollowCodeCard";
import { useOnlineStatus } from "../../hooks/useOnlineStatus";
import { OfflineBanner } from "../../components/OfflineBanner";

const STATUS_LABELS: Record<PresenceStatus, string> = {
  looking_for_game: "Online",
  home: "Online",
  browsing_high_scores: "High scores",
  browsing_leaderboard: "Leaderboards",
  game_lobby: "In lobby",
  playing: "Playing",
  in_score_dialog: "Sharing score",
};

function formatLastOnline(timestamp?: string | null) {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 60 * 1000) return "Last online moments ago";
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 60) return `Last online ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Last online ${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `Last online ${days}d ago`;
}

export default function FollowersPage() {
  const [data, setData] = useState<FollowersSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionUser, setActionUser] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState("");
  const [manualMessage, setManualMessage] = useState<string | null>(null);
  const [manualStatus, setManualStatus] = useState<"success" | "error" | null>(null);
  const [manualBusy, setManualBusy] = useState(false);
  const [confirmUnfollow, setConfirmUnfollow] = useState<{ userId: string; name: string } | null>(
    null
  );
  const { user } = useAuth();
  const { isOnline } = useOnlineStatus();
  const [searchParams, setSearchParams] = useSearchParams();
  const anchor = searchParams.get("view") === "followers" ? "followers" : "following";

  usePresenceReporter({ status: "home", enabled: true });

  const refresh = useCallback(async () => {
    setError(null);
    setLoading(true);

    // Check if offline
    if (!navigator.onLine) {
      setError("You're offline. Connect to view followers.");
      setLoading(false);
      return;
    }

    try {
      const summary = await fetchFollowersSummary();
      setData(summary);
    } catch (err: any) {
      if (!navigator.onLine) {
        setError("You're offline. Connect to view followers.");
      } else {
        setError(err?.message || "Failed to load followers");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user?.userId) {
      setData(null);
      setLoading(false);
      return;
    }
    void refresh();
  }, [user?.userId, refresh]);

  useEffect(() => {
    if (!manualMessage) return;
    if (typeof window === "undefined") return;
    const timer = window.setTimeout(() => {
      setManualMessage(null);
      setManualStatus(null);
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [manualMessage]);

  const gamesById = useMemo(() => {
    const map = new Map<string, string>();
    games.forEach((game) => map.set(game.id, game.title));
    return map;
  }, []);

  const describePresence = useCallback(
    (presence?: { status?: PresenceStatus; gameTitle?: string | null; gameId?: string | null }) => {
      if (!presence?.status) return null;
      const base = STATUS_LABELS[presence.status] || "Online";
      const shouldShowGame = ["game_lobby", "playing", "in_score_dialog"].includes(presence.status);
      const gameName =
        presence.gameTitle ||
        (presence.gameId ? gamesById.get(presence.gameId) || presence.gameId : null);
      if (shouldShowGame && gameName) {
        return `${base} · ${gameName}`;
      }
      return base;
    },
    [gamesById]
  );

  const handleUnfollow = async (userId: string) => {
    setActionUser(userId);
    try {
      await unfollowUserApi(userId);
      setConfirmUnfollow(null);
      await refresh();
    } catch (err: any) {
      setError(err?.message || "Unable to unfollow right now");
    } finally {
      setActionUser(null);
    }
  };

  const handleFollowBack = async (userId: string) => {
    setActionUser(userId);
    try {
      await followUserApi(userId);
      await refresh();
    } catch (err: any) {
      setError(err?.message || "Unable to follow right now");
    } finally {
      setActionUser(null);
    }
  };

  const handleFollowByCode = async () => {
    const target = codeInput.trim();
    if (!target) {
      setManualStatus("error");
      setManualMessage("Enter a follow code first");
      return;
    }
    setManualBusy(true);
    setManualMessage(null);
    setManualStatus(null);
    try {
      await followUserApi(target);
      setManualMessage("Followed! They'll appear once they follow you back.");
      setManualStatus("success");
      setCodeInput("");
      await refresh();
    } catch (err: any) {
      setManualMessage(err?.message || "Unable to follow that code");
      setManualStatus("error");
    } finally {
      setManualBusy(false);
    }
  };

  const followingIds = useMemo(() => {
    return new Set(data?.following.map((edge) => edge.targetUserId) ?? []);
  }, [data?.following]);

  const handleTabChange = (tab: "following" | "followers") => {
    if (tab === "followers") {
      setSearchParams({ view: "followers" });
    } else {
      setSearchParams({});
    }
  };

  const renderFollowing = () => {
    if (!data) return null;
    if (data.following.length === 0) {
      return <p className="text-sm text-flingo-600">You&apos;re not following anyone yet.</p>;
    }
    return (
      <ul className="space-y-3">
        {data.following.map((edge) => {
          const presenceText = describePresence(edge.presence);
          const levelText = edge.level ? `Level ${edge.level}` : null;
          const lastOnline = formatLastOnline(edge.lastOnline ?? edge.presence?.updatedAt);
          const displayName = edge.targetScreenName ?? (edge as any).screenName ?? "Player";
          const avatar = edge.targetAvatar ?? (edge as any).avatar ?? 1;
          const profileId = edge.targetUserId ?? edge.userId;
          return (
            <li
              key={`${profileId}-${edge.createdAt}`}
              className="flex items-center justify-between border-2 border-flingo-100 rounded-2xl p-4 hover:border-flingo-200 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <ProfileAvatar user={{ avatar }} size={48} />
                <div className="min-w-0">
                  <Link
                    to={`/profile/${profileId}`}
                    className="text-sm font-bold text-flingo-800 truncate block hover:text-flingo-600"
                  >
                    {displayName}
                  </Link>
                  {presenceText && (
                    <div className="text-xs text-candy-mint font-medium">{presenceText}</div>
                  )}
                  {(levelText || lastOnline) && (
                    <div className="text-xs text-flingo-400 flex flex-wrap gap-2 mt-0.5">
                      {levelText && <span>{levelText}</span>}
                      {lastOnline && <span>{lastOnline}</span>}
                    </div>
                  )}
                </div>
              </div>
              <button
                className="w-8 h-8 flex items-center justify-center text-red-600 hover:bg-red-50 rounded-full transition-colors"
                onClick={() => setConfirmUnfollow({ userId: profileId, name: displayName })}
                disabled={actionUser === profileId}
                aria-label={`Unfollow ${displayName}`}
                title="Unfollow"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </li>
          );
        })}
      </ul>
    );
  };

  const renderFollowers = () => {
    if (!data) return null;
    if (data.followers.length === 0) {
      return <p className="text-sm text-flingo-600">No one is following you yet.</p>;
    }
    return (
      <ul className="space-y-3">
        {data.followers.map((edge) => {
          const isFollowing = followingIds.has(edge.userId);
          return (
            <li
              key={`${edge.userId}-${edge.createdAt}`}
              className="flex items-center justify-between border-2 border-flingo-100 rounded-2xl p-4 hover:border-flingo-200 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <ProfileAvatar user={{ avatar: edge.avatar ?? 1 }} size={48} />
                <div className="min-w-0">
                  <Link
                    to={`/profile/${edge.userId}`}
                    className="text-sm font-bold text-flingo-800 truncate block hover:text-flingo-600"
                  >
                    {edge.screenName ?? "Player"}
                  </Link>
                </div>
              </div>
              {isFollowing ? (
                <span className="text-xs text-flingo-500 font-medium">Following</span>
              ) : (
                <button
                  className="text-xs font-bold text-flingo-600 border-2 border-flingo-200 rounded-full px-4 py-1.5 hover:bg-flingo-50 transition-colors"
                  onClick={() => handleFollowBack(edge.userId)}
                  disabled={actionUser === edge.userId}
                >
                  {actionUser === edge.userId ? "Following" : "Follow back"}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-flingo-800">Followers</h1>
        <Link to="/" className="text-sm text-flingo-600 font-medium hover:text-flingo-800">
          Back to games
        </Link>
      </div>
      {!isOnline && <OfflineBanner className="mt-4" />}
      {loading && <div className="mt-4 text-flingo-600">Loading...</div>}
      {error && !loading && <div className="mt-4 text-sm text-red-600">{error}</div>}
      {user?.userId && (
        <div className="mt-6">
          <ShareFollowCodeCard
            userId={user.userId}
            screenName={user.screenName}
            description="Send your code or personal link so people can follow you without searching. The same code is always visible on your Profile page."
          >
            <div>
              <label className="text-sm font-bold text-flingo-700" htmlFor="follow-code-input">
                Follow someone by code
              </label>
              <p className="text-xs text-flingo-500 mb-2">
                Paste the code they shared with you and we&apos;ll follow them instantly.
              </p>
              <div className="flex flex-col gap-3 md:flex-row">
                <input
                  id="follow-code-input"
                  type="text"
                  className="flex-1 border-2 border-flingo-200 rounded-full px-4 py-2 text-sm focus:border-flingo-400 focus:outline-none transition-colors"
                  placeholder="e.g. user_123abc"
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value)}
                  autoComplete="off"
                />
                <button
                  type="button"
                  className="px-6 py-2 rounded-full text-sm font-bold border-2 border-candy-mint text-white bg-gradient-to-r from-candy-mint to-emerald-500 disabled:opacity-60 shadow-fun hover:shadow-fun-lg transition-all"
                  onClick={handleFollowByCode}
                  disabled={manualBusy}
                >
                  {manualBusy ? "Following…" : "Follow"}
                </button>
              </div>
              {manualMessage && (
                <p
                  className={`mt-2 text-xs font-medium ${
                    manualStatus === "error" ? "text-red-600" : "text-candy-mint"
                  }`}
                >
                  {manualMessage}
                </p>
              )}
            </div>
          </ShareFollowCodeCard>
        </div>
      )}
      {!loading && data && (
        <section className="mt-6 border-2 border-flingo-100 rounded-2xl bg-white p-5 shadow-card">
          <div className="flex gap-2 bg-flingo-50 rounded-full p-1">
            {[
              { id: "following" as const, label: `Following (${data.followingCount})` },
              { id: "followers" as const, label: `Followers (${data.followersCount})` },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`flex-1 px-4 py-2 text-sm font-bold rounded-full transition ${
                  anchor === tab.id ? "bg-white text-flingo-700 shadow-fun" : "text-flingo-500"
                }`}
                onClick={() => handleTabChange(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="mt-4" aria-live="polite">
            {anchor === "followers" ? renderFollowers() : renderFollowing()}
          </div>
        </section>
      )}
      {confirmUnfollow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setConfirmUnfollow(null)} />
          <div className="relative bg-white rounded-3xl p-6 max-w-sm mx-4 shadow-fun-lg border-2 border-flingo-100">
            <h3 className="text-lg font-bold text-flingo-800 mb-2">
              Unfollow {confirmUnfollow.name}?
            </h3>
            <p className="text-sm text-flingo-600 mb-4">
              Are you sure you want to unfollow this player? You can follow them again anytime.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                className="flex-1 btn btn-outline"
                onClick={() => setConfirmUnfollow(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="flex-1 px-4 py-2 rounded-full text-sm font-bold bg-red-500 text-white shadow-fun hover:bg-red-600 transition-colors"
                onClick={() => handleUnfollow(confirmUnfollow.userId)}
                disabled={actionUser === confirmUnfollow.userId}
              >
                {actionUser === confirmUnfollow.userId ? "Unfollowing..." : "Unfollow"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
