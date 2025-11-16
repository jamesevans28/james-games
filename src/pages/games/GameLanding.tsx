import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthProvider";
import { trackShare } from "../../utils/analytics";
import { GameMeta } from "../../games";
import { getTopScores, fetchRatingSummary, submitRating, RatingSummary } from "../../lib/api";
import { getUserName } from "../../utils/user";
import { onGameOver } from "../../utils/gameEvents";
import { ProfileAvatar } from "../../components/profile";
import RatingStars from "../../components/RatingStars";
import { getCachedRatingSummary, setCachedRatingSummary } from "../../utils/ratingCache";

type Props = {
  meta: GameMeta;
  onPlay: () => void;
};

type ScoreRow = { screenName: string; avatar: number; score: number; createdAt?: string };

// Global cache for leaderboards to avoid refetching on every load
const leaderboardCache = new Map<string, { data: ScoreRow[]; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export default function GameLanding({ meta, onPlay }: Props) {
  const [top, setTop] = useState<ScoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cachedRating = useMemo(() => getCachedRatingSummary(meta.id), [meta.id]);
  const [ratingSummary, setRatingSummary] = useState<RatingSummary | null>(cachedRating);
  const [ratingLoading, setRatingLoading] = useState(!cachedRating);
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [ratingError, setRatingError] = useState<string | null>(null);
  const [userRating, setUserRating] = useState<number | null>(null);
  const { user } = useAuth();

  const bestKey = useMemo(() => `${meta.id}-best`, [meta.id]);
  const myBest = useMemo(() => Number(localStorage.getItem(bestKey) || 0), [bestKey]);

  useEffect(() => {
    let cancelled = false;
    const loadRating = async () => {
      setRatingLoading(true);
      setRatingError(null);
      try {
        const summary = await fetchRatingSummary(meta.id);
        if (cancelled) return;
        setRatingSummary(summary);
        setCachedRatingSummary(summary);
        setUserRating(
          typeof summary.userRating === "number" && !Number.isNaN(summary.userRating)
            ? summary.userRating
            : null
        );
      } catch (err) {
        console.warn("Failed to load rating", err);
        if (!cancelled) setRatingError("Unable to load rating right now");
      } finally {
        if (!cancelled) setRatingLoading(false);
      }
    };
    loadRating();
    return () => {
      cancelled = true;
    };
  }, [meta.id, user?.userId]);

  const handleSubmitRating = async (value: number) => {
    if (!user) return;
    setRatingSubmitting(true);
    setRatingError(null);
    try {
      const summary = await submitRating(meta.id, value);
      setRatingSummary(summary);
      setCachedRatingSummary(summary);
      setUserRating(summary.userRating ?? value);
    } catch (err: any) {
      console.error("Failed to submit rating", err);
      if (err?.message === "signin_required") {
        setRatingError("Sign in to rate this game (maybe relog).");
      } else {
        setRatingError("Unable to save your rating. Please try again.");
      }
    } finally {
      setRatingSubmitting(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const now = Date.now();
      const cached = leaderboardCache.get(meta.id);
      if (cached && now - cached.timestamp < CACHE_DURATION) {
        // Use cached data
        if (!cancelled) setTop(cached.data);
        if (!cancelled) setLoading(false);
        return;
      }

      try {
        const rows = await getTopScores(meta.id, 10);
        if (!cancelled) {
          setTop(rows);
          // Cache the result
          leaderboardCache.set(meta.id, { data: rows, timestamp: now });
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) setError("Failed to load leaderboard");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    // Listen for game over events to refresh leaderboard when a new score might be posted
    const off = onGameOver((detail) => {
      if (detail.gameId === meta.id) {
        // Clear cache and reload
        leaderboardCache.delete(meta.id);
        load();
      }
    });

    return () => {
      cancelled = true;
      off?.();
    };
  }, [meta.id]);

  function fmtDateShort(iso?: string) {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfToday.getDate() - 1);

    if (d >= startOfToday) return "Today";
    if (d >= startOfYesterday) return "Yesterday";

    const day = String(d.getDate()).padStart(2, "0");
    const mon = d.toLocaleString(undefined, { month: "short" });
    const yy = String(d.getFullYear()).slice(-2);
    return `${day} ${mon} ${yy}`;
  }

  async function handleShare() {
    const shareText = `${meta.title} — my best: ${myBest}`;
    const url = `${window.location.origin}/games/${meta.id}`;
    try {
      if ((navigator as any).share) {
        await (navigator as any).share({ title: meta.title, text: shareText, url });
        trackShare(meta.id, meta.title, myBest);
        return;
      }

      await navigator.clipboard.writeText(`${shareText} ${url}`);
      trackShare(meta.id, meta.title, myBest);
    } catch (e) {
      console.error("share failed", e);
    }
  }

  return (
    <div className="min-h-[calc(100vh-64px)] pb-24">
      <div className="pt-16 px-4 max-w-4xl mx-auto">
        {/* Hero image */}
        <div
          className="h-56 bg-cover bg-center rounded"
          style={{ backgroundImage: `url(${meta.thumbnail || "/assets/logo.png"})` }}
          title={meta.title}
        />

        <div className="mt-4">
          <h1 className="text-2xl font-extrabold mb-1 text-black">{meta.title}</h1>
          {meta.description && (
            <p className="text-gray-600 text-sm leading-relaxed">{meta.description}</p>
          )}
          {/* Leaderboard Top 3 + 4-10 */}
          <LeaderboardSection top={top} loading={loading} error={error} myBest={myBest} />

          <RatingSummaryCard
            loading={ratingLoading}
            summary={ratingSummary}
            user={user}
            userRating={userRating}
            error={ratingError}
            submitting={ratingSubmitting}
            onRate={handleSubmitRating}
          />

          {/* metadata list */}
          <div className="mt-6">
            <ul className="w-full bg-white text-sm text-gray-700 divide-y divide-gray-200 border border-gray-200 rounded">
              {meta.createdAt && (
                <li className="px-3 py-2 flex justify-between">
                  <span>Created</span>
                  <span>{fmtDateShort(meta.createdAt) ?? "—"}</span>
                </li>
              )}
              {meta.updatedAt && (
                <li className="px-3 py-2 flex justify-between">
                  <span>Updated</span>
                  <span>{fmtDateShort(meta.updatedAt) ?? "—"}</span>
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>

      {/* sticky footer with Play + Share */}
      <div className="fixed left-0 right-0 bottom-0 bg-white border-t border-gray-200 px-4 py-3">
        <div className="max-w-4xl mx-auto flex gap-3">
          <button type="button" className="btn btn-primary flex-1" onClick={onPlay}>
            Play
          </button>
          <button
            type="button"
            className="btn btn-secondary w-12 flex items-center justify-center"
            onClick={handleShare}
            aria-label="Share"
            title="Share"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
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
          </button>
        </div>
      </div>
    </div>
  );
}

function LeaderboardSection({
  top,
  loading,
  error,
  myBest,
}: {
  top: ScoreRow[];
  loading: boolean;
  error: string | null;
  myBest: number;
}) {
  const userName = useMemo(() => (getUserName ? getUserName() : ""), []);
  const { user } = useAuth();

  // Debugging: log leaderboard inputs so we can trace why nothing renders
  // (some runtime environments may return unexpected shapes)
  // eslint-disable-next-line no-console
  console.debug("LeaderboardSection", { top, loading, error, userName, user });

  if (loading) return <div className="mt-4 text-gray-600">Loading…</div>;
  if (error) return <div className="mt-4 text-red-600">{error}</div>;
  if (!top || top.length === 0) return <div className="mt-4 text-gray-600">No scores yet.</div>;

  const first = top[0];
  const second = top[1];
  const third = top[2];

  // Find the user's top score within the current leaderboard (first occurrence is the highest)
  const userMatchName = String(user?.screenName || userName || "").toLowerCase();
  const userTopRow = top.find((r) => (r?.screenName || "").toLowerCase() === userMatchName);

  // Layout: 2nd - 1st - 3rd (middle taller)
  return (
    <div className="mt-4">
      {/* Top 3 boxes */}
      <div className="flex items-end gap-3">
        <TopBox
          pos={2}
          row={second}
          tall={false}
          medal="silver"
          isUserBest={
            !!userTopRow &&
            second?.score === userTopRow.score &&
            (second?.screenName || "").toLowerCase() === userMatchName
          }
        />
        <TopBox
          pos={1}
          row={first}
          tall={true}
          medal="gold"
          isUserBest={
            !!userTopRow &&
            first?.score === userTopRow.score &&
            (first?.screenName || "").toLowerCase() === userMatchName
          }
        />
        <TopBox
          pos={3}
          row={third}
          tall={false}
          medal="bronze"
          isUserBest={
            !!userTopRow &&
            third?.score === userTopRow.score &&
            (third?.screenName || "").toLowerCase() === userMatchName
          }
        />
      </div>

      {/* If visitor is not logged in, show hint about logging in to record scores */}
      {!user && (
        <div className="mt-3 p-3 rounded border border-yellow-200 bg-yellow-50 text-yellow-800 text-sm">
          To record your scores you need to be logged in.{" "}
          <Link to="/login" className="underline">
            Sign in
          </Link>{" "}
          or create an account.
        </div>
      )}

      {/* Positions 4 - 10 */}
      <div className="mt-4">
        <ol
          start={4}
          className="w-full bg-white divide-y divide-gray-200 border border-gray-200 rounded"
        >
          {top.slice(3, 10).map((r, i) => {
            const rank = 4 + i;
            const isYou =
              !!userTopRow &&
              r?.score === userTopRow.score &&
              (r?.screenName || "").toLowerCase() === userMatchName;
            return (
              <li
                key={`${r?.screenName ?? "anon"}-${rank}`}
                className="flex items-center justify-between px-3 py-2 text-sm"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-gray-500 font-mono w-6">#{rank}</span>
                  <span className="truncate text-black">{r?.screenName ?? "—"}</span>
                  {isYou && (
                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700 border border-blue-200">
                      your top score
                    </span>
                  )}
                </div>
                <span className="font-mono text-black">{r?.score ?? 0}</span>
              </li>
            );
          })}
        </ol>
      </div>

      {/* If the user is logged in but none of their scores made the top leaderboard,
            show their personal best so they know what to try to beat. */}
      {user && !userTopRow && myBest > 0 && (
        <div className="mt-4 p-3 rounded border border-gray-200 bg-white text-sm text-gray-700">
          <div className="font-semibold">Your personal best</div>
          <div className="mt-2 text-2xl font-bold">{myBest}</div>
          <div className="mt-1 text-xs text-gray-500">
            Keep playing to submit this score to the leaderboards.
          </div>
        </div>
      )}
    </div>
  );
}

function RatingSummaryCard({
  loading,
  summary,
  user,
  userRating,
  error,
  submitting,
  onRate,
}: {
  loading: boolean;
  summary: RatingSummary | null;
  user: ReturnType<typeof useAuth>["user"];
  userRating: number | null;
  error: string | null;
  submitting: boolean;
  onRate: (value: number) => void;
}) {
  const avg = summary?.avgRating ?? 0;
  const count = summary?.ratingCount ?? 0;
  return (
    <div className="mt-6 border border-gray-200 rounded-lg p-4 bg-white">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500">Overall rating</p>
          <div className="text-3xl font-extrabold text-black">{loading ? "—" : avg.toFixed(1)}</div>
          <p className="text-xs text-gray-500">{count} total ratings</p>
        </div>
        <RatingStars value={avg} readOnly size="sm" />
      </div>
      <div className="mt-4 border-t border-gray-100 pt-4">
        {user ? (
          <div>
            <p className="text-sm font-semibold text-black flex items-center">
              Your rating
              {submitting && (
                <svg
                  className="ml-2 w-4 h-4 animate-spin text-gray-500"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    opacity="0.25"
                  />
                  <path
                    d="M22 12a10 10 0 00-10-10"
                    stroke="currentColor"
                    strokeWidth="4"
                    strokeLinecap="round"
                  />
                </svg>
              )}
            </p>
            <div className="mt-2">
              <RatingStars
                value={userRating ?? 0}
                onSelect={(value) => onRate(value)}
                readOnly={loading || submitting}
              />
            </div>
            {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
          </div>
        ) : (
          <p className="text-sm text-gray-600">
            <Link to="/login" className="text-blue-600 underline">
              Sign in
            </Link>{" "}
            to rate this game.
          </p>
        )}
      </div>
    </div>
  );
}

function TopBox({
  pos,
  row,
  tall,
  medal,
  isUserBest,
}: {
  pos: 1 | 2 | 3;
  row?: ScoreRow;
  tall: boolean;
  medal: "gold" | "silver" | "bronze";
  isUserBest?: boolean;
}) {
  const medalBg =
    medal === "gold"
      ? "rgba(255,215,0,0.18)"
      : medal === "silver"
      ? "rgba(192,192,192,0.18)"
      : "rgba(205,127,50,0.18)";
  const tagBg = medal === "gold" ? "#FFD700" : medal === "silver" ? "#C0C0C0" : "#CD7F32";
  const tagText = medal === "bronze" ? "text-white" : "text-gray-900";

  return (
    <div className="flex-1 min-w-0">
      <div
        className={`rounded-lg border border-gray-200 p-3 flex flex-col items-center justify-between ${
          tall ? "min-h-48" : "min-h-40"
        }`}
        style={{ background: `linear-gradient(to top, ${medalBg} 0%, transparent 60%)` }}
      >
        <div className="w-full flex flex-col items-center min-w-0">
          <div className="text-xs text-gray-500 font-semibold">#{pos}</div>
          <div className="mt-2">
            <ProfileAvatar
              user={{ avatar: row?.avatar ?? 1 }}
              size={tall ? 56 : 44}
              borderWidth={2}
              strokeWidth={2}
              borderColor={"#ffffff"}
              strokeColor={"#000000"}
              title={row?.screenName ?? "Player"}
            />
          </div>
          <div className="mt-2 text-sm font-medium text-black truncate max-w-full text-center min-w-0">
            <span className="truncate block max-w-full">{row?.screenName ?? "—"}</span>
            {/** show small badge for user's top score */}
            {isUserBest && (
              <div className="mt-1 inline-block px-2 py-0.5 text-[10px] font-semibold bg-blue-100 text-blue-700 rounded-full">
                your top score
              </div>
            )}
          </div>
        </div>
        <div className="mt-3 self-stretch flex justify-center">
          <span
            className={`px-2 py-1 rounded text-xs font-semibold ${tagText}`}
            style={{ backgroundColor: tagBg }}
          >
            {row?.score ?? 0}
          </span>
        </div>
      </div>
    </div>
  );
}
