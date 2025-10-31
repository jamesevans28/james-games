import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { games } from "../../games";
import { getTopScores } from "../../lib/api";
import Seo from "../../components/Seo";

type ScoreRow = { name: string; score: number; createdAt?: string };

export default function LeaderboardPage() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const meta = useMemo(() => games.find((g) => g.id === gameId), [gameId]);
  const [rows, setRows] = useState<ScoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!gameId) return;
      try {
        const res = await getTopScores(gameId, 10);
        setRows(res);
      } catch (e) {
        console.error(e);
        setError("Failed to load leaderboard");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [gameId]);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <Seo
        title={meta ? `${meta.title} Leaderboard — Games4James` : "Leaderboard — Games4James"}
        description={`Top scores for ${meta?.title ?? "this game"} on Games4James.`}
        url={`https://games4james.com/leaderboard/${meta?.id ?? ""}`}
        canonical={`https://games4james.com/leaderboard/${meta?.id ?? ""}`}
        image={"https://games4james.com/assets/logo.png"}
      />
      <header className="fixed top-0 left-0 right-0 z-50 h-14">
        <div className="h-full flex items-center justify-between px-3 bg-gradient-to-r from-fuchsia-600 via-purple-600 to-sky-600 text-white shadow-lg border-b border-white/20">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 rounded-full bg-white/15 hover:bg-white/25 transition-colors px-3 py-1.5"
            aria-label="Close leaderboard"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            <span className="text-sm font-medium">Close</span>
          </button>
          <div className="text-center pointer-events-none select-none">
            <div className="text-lg font-extrabold drop-shadow-sm">Top 10</div>
            <div className="text-[10px] opacity-80 leading-none">{meta?.title ?? "Game"}</div>
          </div>
          <div className="w-[84px]" />
        </div>
      </header>
      <div className="pt-16 pb-6 px-4 max-w-xl w-full mx-auto">
        {loading && <div className="text-white/80">Loading…</div>}
        {error && <div className="text-red-400">{error}</div>}
        {!loading && !error && (
          <ol className="divide-y divide-white/10 rounded-2xl overflow-hidden bg-white/5 border border-white/10">
            {rows.map((r, i) => (
              <li key={`${r.name}-${i}`} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="w-6 text-white/70">{i + 1}.</span>
                  <span className="font-semibold">{r.name}</span>
                </div>
                <div className="text-right font-mono">{r.score}</div>
              </li>
            ))}
            {rows.length === 0 && <div className="px-4 py-6 text-white/60">No scores yet.</div>}
          </ol>
        )}
      </div>
    </div>
  );
}
