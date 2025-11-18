import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { games } from "../../games";
import { fetchUserProfile, followUserApi, unfollowUserApi } from "../../lib/api";
import { ProfileAvatar } from "../../components/profile";
import { useAuth } from "../../context/AuthProvider";
import { usePresenceReporter } from "../../hooks/usePresenceReporter";
import { buildProfileLink, shareProfileLink } from "../../utils/shareProfileLink";

interface ProfileResponse {
  profile: {
    userId: string;
    screenName?: string | null;
    avatar?: number | null;
  };
  followingCount: number;
  followersCount: number;
  following: Array<{ userId: string; screenName?: string | null; avatar?: number | null }>;
  followers: Array<{ userId: string; screenName?: string | null; avatar?: number | null }>;
  recentGames: Array<{
    userId: string;
    gameId: string;
    bestScore?: number;
    lastScore?: number;
    lastPlayedAt?: string;
  }>;
  isSelf: boolean;
  isFollowing: boolean;
}

export default function ProfilePage() {
  const { userId } = useParams();
  const { user } = useAuth();
  const [data, setData] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [shareHint, setShareHint] = useState<string | null>(null);
  const [shareExpanded, setShareExpanded] = useState(false);

  usePresenceReporter({ status: "home", enabled: true });

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      setNotFound(false);
      try {
        const res = await fetchUserProfile(userId);
        if (!res) {
          if (!cancelled) {
            setNotFound(true);
            setData(null);
          }
          return;
        }
        if (!cancelled) setData(res as ProfileResponse);
      } catch (err: any) {
        if (err?.message === "user_not_found" || err?.status === 404) {
          setNotFound(true);
          setData(null);
        } else {
          setError(err?.message || "Failed to load profile");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!shareHint) return;
    if (typeof window === "undefined") return;
    const timer = window.setTimeout(() => setShareHint(null), 2500);
    return () => window.clearTimeout(timer);
  }, [shareHint]);

  const profileUserId = data?.profile.userId ?? "";
  const profileLink = useMemo(() => (profileUserId ? buildProfileLink(profileUserId) : ""), [profileUserId]);

  const handleFollowToggle = async () => {
    if (!data || !userId) return;
    setBusy(true);
    try {
      if (data.isFollowing) {
        await unfollowUserApi(userId);
        setData({
          ...data,
          isFollowing: false,
          followersCount: Math.max(0, data.followersCount - 1),
        });
      } else {
        await followUserApi(userId);
        setData({ ...data, isFollowing: true, followersCount: data.followersCount + 1 });
      }
    } catch (err: any) {
      setError(err?.message || "Unable to update follow state");
    } finally {
      setBusy(false);
    }
  };

  const recentGames = useMemo(() => {
    if (!data?.recentGames) return [];
    return data.recentGames.map((entry) => {
      const meta = games.find((g) => g.id === entry.gameId);
      return {
        ...entry,
        title: meta?.title ?? entry.gameId,
        thumbnail: meta?.thumbnail ?? "/assets/logo.png",
      };
    });
  }, [data?.recentGames]);

  if (loading) {
    return <div className="p-4 text-gray-600">Loading profile…</div>;
  }
  if (notFound) {
    return (
      <div className="p-4 text-gray-700">
        <p className="text-lg font-semibold">Player not found.</p>
        <Link to="/" className="text-blue-600 underline">
          Back to games
        </Link>
      </div>
    );
  }
  if (!data) {
    return <div className="p-4 text-red-600">{error ?? "Failed to load profile."}</div>;
  }

  const canFollow = !!user && !data.isSelf;

  const handleShareProfileLink = async () => {
    if (!data?.profile.userId) return;
    const result = await shareProfileLink({
      userId: data.profile.userId,
      screenName: data.profile.screenName,
      isSelf: data.isSelf,
    });
    if (result.status === "shared") {
      setShareHint("Sent via your share sheet");
    } else if (result.status === "copied") {
      setShareHint("Profile link copied to clipboard");
    } else {
      setShareHint(`Share this link: ${result.url}`);
    }
  };

  const handleCopyCode = async () => {
    if (!data?.profile.userId) return;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(data.profile.userId);
        setShareHint("Follow code copied");
        return;
      }
    } catch (err) {
      console.warn("copy failed", err);
    }
    setShareHint(`Code: ${data.profile.userId}`);
  };

  const handleCopyLink = async () => {
    if (!profileLink) return;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(profileLink);
        setShareHint("Profile link copied");
        return;
      }
    } catch (err) {
      console.warn("copy failed", err);
    }
    setShareHint(`Link: ${profileLink}`);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          {data.isSelf ? (
            <Link
              to="/settings/avatar"
              className="rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Edit avatar"
            >
              <ProfileAvatar user={{ avatar: data.profile.avatar ?? 1 }} size={72} />
            </Link>
          ) : (
            <ProfileAvatar user={{ avatar: data.profile.avatar ?? 1 }} size={72} />
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-extrabold text-black">
                {data.profile.screenName ?? "Player"}
              </h1>
              {data.isSelf && (
                <Link
                  to="/settings"
                  className="p-1 rounded-full border border-gray-200 text-gray-600 hover:text-black hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label="Edit screen name"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      d="M13.5 6.5L17.5 10.5M5 19H9L19 9C19.8284 8.17157 19.8284 6.82843 19 6L18 5C17.1716 4.17157 15.8284 4.17157 15 5L5 15V19Z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </Link>
              )}
            </div>
          </div>
        </div>
        {canFollow && (
          <button
            className={`px-4 py-2 rounded-full text-sm font-semibold border transition-colors ${
              data.isFollowing
                ? "border-gray-300 text-gray-700 bg-white"
                : "border-blue-600 text-white bg-blue-600"
            }`}
            disabled={busy}
            onClick={handleFollowToggle}
          >
            {busy ? "Working…" : data.isFollowing ? "Following" : "Follow this player"}
          </button>
        )}
      </div>

      {data.isSelf && (
        <section className="border border-gray-200 rounded-2xl bg-white shadow-sm">
          <button
            type="button"
            className="w-full flex items-center justify-between px-4 py-3 text-left"
            onClick={() => setShareExpanded((prev) => !prev)}
            aria-expanded={shareExpanded}
          >
            <span className="text-lg font-semibold text-black">Share your follow code</span>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              className={`transition-transform ${shareExpanded ? "rotate-180" : ""}`}
              aria-hidden
            >
              <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {shareExpanded && (
            <div className="px-4 pb-4">
              <p className="text-sm text-gray-600">
                Send this link or code to friends so they can follow you instantly.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <code className="text-xl font-mono font-semibold px-4 py-2 rounded-lg bg-gray-900 text-white">
                  {data.profile.userId}
                </code>
                <button
                  type="button"
                  className="px-3 py-2 text-sm font-semibold border border-gray-300 rounded-full"
                  onClick={handleCopyCode}
                >
                  Copy code
                </button>
                <button
                  type="button"
                  className="px-3 py-2 text-sm font-semibold border border-gray-300 rounded-full"
                  onClick={handleCopyLink}
                >
                  Copy link
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-full text-sm font-semibold border border-blue-600 text-blue-600 hover:bg-blue-50"
                  onClick={handleShareProfileLink}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      d="M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M16 6l-4-4-4 4"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M12 2v13"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Share link
                </button>
              </div>
              <p className="mt-3 text-sm text-gray-600">
                Anyone can open{" "}
                <span className="px-1 font-mono text-xs text-gray-900 break-all">{profileLink}</span>{" "}
                or paste your follow code on the Followers page to connect.
              </p>
              {shareHint && <p className="mt-2 text-xs text-green-600">{shareHint}</p>}
            </div>
          )}
        </section>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Followers"
          value={data.followersCount}
          to={data.isSelf ? "/followers?view=followers" : undefined}
        />
        <StatCard
          label="Following"
          value={data.followingCount}
          to={data.isSelf ? "/followers?view=following" : undefined}
        />
        <StatCard label="Recent games" value={data.recentGames.length} />
        <StatCard label="Status" value={data.isSelf ? "This is you" : data.isFollowing ? "Following" : "Not following"} />
      </div>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-black">Recent games</h2>
        </div>
        {recentGames.length === 0 ? (
          <p className="text-sm text-gray-600">No recent games to show.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {recentGames.map((entry) => (
              <div key={entry.gameId} className="border border-gray-200 rounded-lg overflow-hidden">
                <div
                  className="aspect-[4/5] bg-cover bg-center"
                  style={{ backgroundImage: `url(${entry.thumbnail})` }}
                />
                <div className="p-3">
                  <div className="text-sm font-semibold text-black">{entry.title}</div>
                  <div className="text-xs text-gray-500">Best score: {entry.bestScore ?? "—"}</div>
                  <div className="text-xs text-gray-400">
                    Last played: {entry.lastPlayedAt ? new Date(entry.lastPlayedAt).toLocaleDateString() : "—"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {!data.isSelf && (
        <section className="grid md:grid-cols-2 gap-6">
          <ConnectionsList title="Following" items={data.following} empty="Not following anyone yet." />
          <ConnectionsList title="Followers" items={data.followers} empty="No followers yet." />
        </section>
      )}
      {data.isSelf && (
        <section className="border border-gray-200 rounded-2xl p-4 bg-white text-sm text-gray-600">
          Looking for the full list of people you follow? Head to the
          <Link to="/followers" className="ml-1 text-blue-600 underline">
            Followers page
          </Link>
          to manage follow requests and follow codes.
        </section>
      )}
    </div>
  );
}

function StatCard({ label, value, to }: { label: string; value: number | string; to?: string }) {
  if (to) {
    return (
      <Link
        to={to}
        className="border border-gray-200 rounded-lg p-4 bg-white hover:shadow focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
      >
        <p className="text-xs uppercase text-gray-500">{label}</p>
        <p className="text-2xl font-extrabold text-black">{value}</p>
        <span className="mt-2 text-xs text-blue-600 inline-flex items-center gap-1">
          View {label.toLowerCase()}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M5 12h14M13 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </span>
      </Link>
    );
  }
  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white">
      <p className="text-xs uppercase text-gray-500">{label}</p>
      <p className="text-2xl font-extrabold text-black">{value}</p>
    </div>
  );
}

function ConnectionsList({
  title,
  items,
  empty,
}: {
  title: string;
  items: Array<{ userId: string; screenName?: string | null; avatar?: number | null }>;
  empty: string;
}) {
  return (
    <div className="border border-gray-200 rounded-2xl bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-black">{title}</h3>
        <span className="text-xs text-gray-500">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-gray-600">{empty}</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.userId} className="flex items-center gap-3">
              <ProfileAvatar user={{ avatar: item.avatar ?? 1 }} size={44} />
              <Link to={`/profile/${item.userId}`} className="text-sm font-semibold text-black">
                {item.screenName ?? "Player"}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
