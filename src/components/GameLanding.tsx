import React, { useEffect, useMemo, useState } from "react";
import { trackShare } from "../utils/analytics";
import { GameMeta } from "../games";
import { getTopScores } from "../lib/api";
import { getUserName } from "../utils/user";
import { onGameOver } from "../utils/gameEvents";

type Props = {
  meta: GameMeta;
  onPlay: () => void;
};

type ScoreRow = { name: string; score: number; createdAt?: string };

// Global cache for leaderboards to avoid refetching on every load
const leaderboardCache = new Map<string, { data: ScoreRow[]; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export default function GameLanding({ meta, onPlay }: Props) {
  const [top, setTop] = useState<ScoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const bestKey = useMemo(() => `${meta.id}-best`, [meta.id]);
  const myBest = useMemo(() => Number(localStorage.getItem(bestKey) || 0), [bestKey]);

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
          <LeaderboardSection top={top} loading={loading} error={error} />

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
}: {
  top: ScoreRow[];
  loading: boolean;
  error: string | null;
}) {
  const userName = useMemo(() => (getUserName ? getUserName() : ""), []);

  if (loading) return <div className="mt-4 text-gray-600">Loading…</div>;
  if (error) return <div className="mt-4 text-red-600">{error}</div>;
  if (!top || top.length === 0) return <div className="mt-4 text-gray-600">No scores yet.</div>;

  const first = top[0];
  const second = top[1];
  const third = top[2];

  // Layout: 2nd - 1st - 3rd (middle taller)
  return (
    <div className="mt-4">
      {/* Top 3 boxes */}
      <div className="flex items-end gap-3">
        <TopBox pos={2} row={second} tall={false} medal="silver" />
        <TopBox pos={1} row={first} tall={true} medal="gold" />
        <TopBox pos={3} row={third} tall={false} medal="bronze" />
      </div>

      {/* Positions 4 - 10 */}
      <div className="mt-4">
        <ol
          start={4}
          className="w-full bg-white divide-y divide-gray-200 border border-gray-200 rounded"
        >
          {top.slice(3, 10).map((r, i) => {
            const rank = 4 + i;
            const isYou = r?.name && userName && r.name.toLowerCase() === userName.toLowerCase();
            return (
              <li
                key={`${r?.name ?? "anon"}-${rank}`}
                className="flex items-center justify-between px-3 py-2 text-sm"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-gray-500 font-mono w-6">#{rank}</span>
                  <span className="truncate text-black">{r?.name ?? "—"}</span>
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
    </div>
  );
}

function TopBox({
  pos,
  row,
  tall,
  medal,
}: {
  pos: 1 | 2 | 3;
  row?: ScoreRow;
  tall: boolean;
  medal: "gold" | "silver" | "bronze";
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
    <div className="flex-1">
      <div
        className={`rounded-lg border border-gray-200 p-3 flex flex-col items-center justify-between ${
          tall ? "min-h-48" : "min-h-40"
        }`}
        style={{ background: `linear-gradient(to top, ${medalBg} 0%, transparent 60%)` }}
      >
        <div className="w-full flex flex-col items-center">
          <div className="text-xs text-gray-500 font-semibold">#{pos}</div>
          <div className="mt-2 h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-700 font-semibold uppercase">
            {row?.name ? row.name.charAt(0) : "?"}
          </div>
          <div className="mt-2 text-sm font-medium text-black truncate max-w-full text-center">
            {row?.name ?? "—"}
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
