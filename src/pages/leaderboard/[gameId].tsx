import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { games } from "../../games";
import { getTopScores } from "../../lib/api";
import { getUserName } from "../../utils/user";
import Seo from "../../components/Seo";

type ScoreRow = { name: string; score: number; createdAt?: string };

export default function LeaderboardPage() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const meta = useMemo(() => games.find((g) => g.id === gameId), [gameId]);
  const [rows, setRows] = useState<ScoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const myName = useMemo(() => getUserName() || "", []);

  useEffect(() => {
    const load = async () => {
      if (!gameId) return;
      try {
        const res = await getTopScores(gameId, 25);
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
    <div className="min-h-screen bg-white text-black flex flex-col">
      <Seo
        title={meta ? `${meta.title} Leaderboard — Games4James` : "Leaderboard — Games4James"}
        description={`Top scores for ${meta?.title ?? "this game"} on Games4James.`}
        url={`https://games4james.com/leaderboard/${meta?.id ?? ""}`}
        canonical={`https://games4james.com/leaderboard/${meta?.id ?? ""}`}
        image={"https://games4james.com/assets/logo.png"}
      />
      <header className="fixed top-0 left-0 right-0 z-50 h-14">
        <div className="h-full flex items-center justify-between px-3 bg-white text-black border-b border-gray-200">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center rounded-md px-3 py-1.5"
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
          </button>
          <div className="text-center pointer-events-none select-none">
            <div className="text-lg font-extrabold">{meta?.title ?? "Game"}</div>
          </div>
          <div className="w-[84px]" />
        </div>
      </header>
      <div className="pt-16 pb-6 px-4 max-w-xl w-full mx-auto">
        {loading && <div className="text-gray-700">Loading…</div>}
        {error && <div className="text-red-600">{error}</div>}
        {!loading && !error && (
          <ol className="rounded-lg overflow-hidden bg-white border border-gray-200">
            {rows.map((r, i) => {
              const isMe = myName && r.name === myName;
              return (
                <li
                  key={`${r.name}-${i}`}
                  className={
                    "flex items-center justify-between px-4 py-3 border-b border-gray-200 last:border-b-0 " +
                    (isMe ? "bg-amber-50" : "")
                  }
                >
                  <div className="flex items-center gap-3">
                    <span className="w-7 text-gray-500 font-mono">{i + 1}.</span>
                    <span className={"font-semibold " + (isMe ? "text-amber-700" : "")}>
                      {r.name}
                    </span>
                  </div>
                  <div className={"text-right font-mono " + (isMe ? "text-amber-700" : "")}>
                    {r.score}
                  </div>
                </li>
              );
            })}
            {rows.length === 0 && <div className="px-4 py-6 text-gray-500">No scores yet.</div>}
          </ol>
        )}
      </div>
    </div>
  );
}
