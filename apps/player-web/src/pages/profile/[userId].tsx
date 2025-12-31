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

interface ProfileResponse {
  profile: {
    userId: string;
    screenName?: string | null;
    avatar?: number | null;
    experience?: ExperienceSummary | null;
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

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <Seo
        title={`${data.profile.screenName ?? "Player"} — Games4James Profile`}
        description={`Check out ${
          data.profile.screenName ?? "Player"
        }'s stats and high scores on Games4James.`}
        url={`https://games4james.com/profile/${userId}`}
        canonical={`https://games4james.com/profile/${userId}`}
      />
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
            {data.profile.experience &&
              (data.isSelf ? (
                <div className="mt-3">
                  <ExperienceBar
                    level={data.profile.experience.level}
                    progress={data.profile.experience.progress}
                    required={data.profile.experience.required}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {Math.max(0, Math.round(data.profile.experience.remaining))} XP to level{" "}
                    {Math.min(100, data.profile.experience.level + 1)}
                  </p>
                </div>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-purple-700 bg-purple-100 px-2 py-1 rounded-full mt-2">
                  Level {data.profile.experience.level}
                </span>
              ))}
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
        <StatCard
          label="Status"
          value={data.isSelf ? "This is you" : data.isFollowing ? "Following" : "Not following"}
        />
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
