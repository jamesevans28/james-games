import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { games } from "../../games";
import {
  fetchUserProfile,
  followUserApi,
  unfollowUserApi,
  type ExperienceSummary,
} from "../../lib/api";
import { ProfileAvatar } from "../../components/profile";
import ShareFollowCodeCard from "../../components/ShareFollowCodeCard";
import { useAuth } from "../../context/FirebaseAuthProvider";
import { usePresenceReporter } from "../../hooks/usePresenceReporter";
import { ExperienceBar } from "../../components/ExperienceBar";
import Seo from "../../components/Seo";
import { useOnlineStatus } from "../../hooks/useOnlineStatus";
import { SITE_URL } from "../../utils/seoKeywords";

interface ProfileResponse {
  profile: {
    userId: string;
    screenName?: string | null;
    avatar?: number | null;
    experience?: ExperienceSummary | null;
    currentStreak?: number;
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
  const { isOnline } = useOnlineStatus();
  const [data, setData] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);

  usePresenceReporter({ status: "home", enabled: true });

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      setNotFound(false);

      // Check if offline
      if (!navigator.onLine) {
        if (!cancelled) {
          setError("You're offline. Connect to view this profile.");
          setLoading(false);
        }
        return;
      }

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
        } else if (!navigator.onLine) {
          setError("You're offline. Connect to view this profile.");
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
    return <div className="p-4 text-flingo-700 font-medium">Loading profile…</div>;
  }
  if (notFound) {
    return (
      <div className="p-4">
        <p className="text-lg font-bold text-flingo-900">Player not found.</p>
        <Link to="/" className="text-flingo-700 hover:text-neon-lime font-medium">
          ← Back to games
        </Link>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="p-4 text-neon-pink font-medium">{error ?? "Failed to load profile."}</div>
    );
  }

  const canFollow = !!user && !data.isSelf;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <Seo
        title={`${data.profile.screenName ?? "Player"} — Profile | flingo.fun`}
        description={`Check out ${
          data.profile.screenName ?? "Player"
        }'s game stats and high scores on flingo.fun - free online games for everyone.`}
        url={`${SITE_URL}/profile/${userId}`}
        canonical={`${SITE_URL}/profile/${userId}`}
        noindex={true}
      />
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          {data.isSelf ? (
            <Link
              to="/settings/avatar"
              className="rounded-full focus:outline-none focus:ring-2 focus:ring-neon-lime/50"
              aria-label="Edit avatar"
            >
              <ProfileAvatar user={{ avatar: data.profile.avatar ?? 1 }} size={72} />
            </Link>
          ) : (
            <ProfileAvatar user={{ avatar: data.profile.avatar ?? 1 }} size={72} />
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-extrabold text-flingo-900">
                {data.profile.screenName ?? "Player"}
              </h1>
              {data.isSelf && (
                <Link
                  to="/settings"
                  className="p-1.5 rounded-full border border-flingo-200/30 text-flingo-600 hover:text-neon-lime hover:border-neon-lime/50 focus:outline-none focus:ring-2 focus:ring-neon-lime/50 transition-colors"
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
            {data.profile.experience &&
              (data.isSelf ? (
                <div className="mt-3">
                  <ExperienceBar
                    level={data.profile.experience.level}
                    progress={data.profile.experience.progress}
                    required={data.profile.experience.required}
                  />
                  <p className="text-xs text-flingo-600 mt-1 font-medium">
                    {Math.max(0, Math.round(data.profile.experience.remaining))} XP to level{" "}
                    {Math.min(100, data.profile.experience.level + 1)}
                  </p>
                </div>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-neon-lime bg-neon-lime/10 px-3 py-1.5 rounded-full mt-2 border border-neon-lime/30">
                  ⭐ Level {data.profile.experience.level}
                </span>
              ))}
          </div>
        </div>
        {canFollow && (
          <button
            className={`px-5 py-2.5 rounded-full text-sm font-bold border transition-all active:scale-95 ${
              data.isFollowing
                ? "border-flingo-200/30 text-flingo-800 bg-surface-card hover:bg-flingo-100"
                : "border-neon-lime text-surface-dark bg-neon-lime shadow-neon-lime hover:shadow-neon-lime"
            }`}
            disabled={busy}
            onClick={handleFollowToggle}
          >
            {busy ? "Working…" : data.isFollowing ? "✓ Following" : "Follow this player"}
          </button>
        )}
      </div>

      {data.isSelf && data.profile.userId && (
        <ShareFollowCodeCard
          userId={data.profile.userId}
          screenName={data.profile.screenName}
          description="Send this link or code to friends so they can follow you instantly."
        />
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
        {(data.profile.currentStreak ?? 0) > 0 ? (
          <StatCard
            label="Day Streak"
            value={<span className="flex items-center gap-1">🔥 {data.profile.currentStreak}</span>}
          />
        ) : (
          <StatCard
            label="Status"
            value={data.isSelf ? "This is you" : data.isFollowing ? "Following" : "Not following"}
          />
        )}
      </div>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-flingo-900">Recent games</h2>
        </div>
        {recentGames.length === 0 ? (
          <p className="text-sm text-flingo-600">No recent games to show.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {recentGames.map((entry) => (
              <div
                key={entry.gameId}
                className="border border-flingo-200/30 rounded-2xl overflow-hidden bg-surface-card hover:border-neon-lime/50 hover:shadow-card-hover transition-all"
              >
                <div
                  className="aspect-[4/5] bg-cover bg-center bg-flingo-100"
                  style={{ backgroundImage: `url(${entry.thumbnail})` }}
                />
                <div className="p-3">
                  <div className="text-sm font-bold text-flingo-900">{entry.title}</div>
                  <div className="text-xs text-flingo-700 font-medium">
                    Best score: {entry.bestScore ?? "—"}
                  </div>
                  <div className="text-xs text-flingo-500">
                    Last played:{" "}
                    {entry.lastPlayedAt ? new Date(entry.lastPlayedAt).toLocaleDateString() : "—"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {!data.isSelf && (
        <section className="grid md:grid-cols-2 gap-6">
          <ConnectionsList
            title="Following"
            items={data.following}
            empty="Not following anyone yet."
          />
          <ConnectionsList title="Followers" items={data.followers} empty="No followers yet." />
        </section>
      )}
      {data.isSelf && (
        <section className="border border-flingo-200/30 rounded-2xl p-4 bg-surface-card text-sm text-flingo-700">
          Looking for the full list of people you follow? Head to the
          <Link to="/followers" className="ml-1 text-neon-lime hover:text-neon-lime font-bold">
            Followers page →
          </Link>
          to manage follow requests and follow codes.
        </section>
      )}
    </div>
  );
}

function StatCard({ label, value, to }: { label: string; value: React.ReactNode; to?: string }) {
  if (to) {
    return (
      <Link
        to={to}
        className="border border-flingo-200/30 rounded-2xl p-4 bg-surface-card hover:border-neon-lime/50 hover:shadow-card-hover focus:outline-none focus:ring-2 focus:ring-neon-lime/50 transition-all"
      >
        <p className="text-xs uppercase text-flingo-600 font-bold">{label}</p>
        <p className="text-2xl font-extrabold text-flingo-900">{value}</p>
        <span className="mt-2 text-xs text-neon-lime font-bold inline-flex items-center gap-1">
          View {label.toLowerCase()}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M5 12h14M13 5l7 7-7 7"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </span>
      </Link>
    );
  }
  return (
    <div className="border border-flingo-200/30 rounded-2xl p-4 bg-surface-card">
      <p className="text-xs uppercase text-flingo-600 font-bold">{label}</p>
      <p className="text-2xl font-extrabold text-flingo-900">{value}</p>
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
    <div className="border border-flingo-200/30 rounded-2xl bg-surface-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-bold text-flingo-900">{title}</h3>
        <span className="text-xs text-flingo-700 font-bold bg-flingo-100 px-2 py-1 rounded-full">
          {items.length}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-flingo-600">{empty}</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.userId} className="flex items-center gap-3">
              <ProfileAvatar user={{ avatar: item.avatar ?? 1 }} size={44} />
              <Link
                to={`/profile/${item.userId}`}
                className="text-sm font-bold text-flingo-900 hover:text-neon-lime"
              >
                {item.screenName ?? "Player"}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
