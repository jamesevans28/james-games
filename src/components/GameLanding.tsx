import { useEffect, useMemo, useState } from "react";
import { trackShare } from "../utils/analytics";
import { useNavigate } from "react-router-dom";
import { GameMeta } from "../games";
import { getTopScores } from "../lib/api";

type Props = {
  meta: GameMeta;
  onPlay: () => void;
};

type ScoreRow = { name: string; score: number; createdAt?: string };

export default function GameLanding({ meta, onPlay }: Props) {
  const navigate = useNavigate();
  const [top, setTop] = useState<ScoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const bestKey = useMemo(() => `${meta.id}-best`, [meta.id]);
  const myBest = useMemo(() => Number(localStorage.getItem(bestKey) || 0), [bestKey]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const rows = await getTopScores(meta.id, 5);
        if (!cancelled) setTop(rows);
      } catch (e) {
        console.error(e);
        if (!cancelled) setError("Failed to load leaderboard");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [meta.id]);

  const handleShare = async () => {
    const shareUrl = `${location.origin}/games/${meta.id}`;
    const scoreText = myBest && myBest > 0 ? `Can you beat my top score of ${myBest} in ${meta.title}?` : `Play ${meta.title} — can you get a new high score?`;
    const data: ShareData = {
      title: `${meta.title} — Games4James`,
      text: `${scoreText} ${shareUrl}`,
      url: shareUrl,
    };
    try {
      if (navigator.share) {
        await navigator.share(data);
        try {
          trackShare(meta.id, meta.title, myBest || undefined);
        } catch {}
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        try {
          trackShare(meta.id, meta.title, myBest || undefined);
        } catch {}
        alert("Link copied to clipboard");
      } else {
        // Fallback: open new tab
        window.open(shareUrl, "_blank");
        try {
          trackShare(meta.id, meta.title, myBest || undefined);
        } catch {}
      }
    } catch {
      // user cancelled or unsupported; ignore
    }
  };

  return (
    <div className="pt-16 pb-8 px-4 max-w-xl w-full mx-auto">
      {/* Hero */}
      <div className="rounded-2xl overflow-hidden bg-white/5 border border-white/10 shadow-xl">
        <div
          className="h-56 bg-cover bg-center"
          style={{ backgroundImage: `url(${meta.thumbnail || "/assets/logo.png"})` }}
          title={meta.title}
        />
        <div className="p-5">
          <h1 className="text-2xl font-extrabold mb-1">{meta.title}</h1>
          {meta.description && (
            <p className="text-white/80 text-sm leading-relaxed">{meta.description}</p>
          )}

          {/* Stats */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-white/5 border border-white/10 p-3">
              <div className="text-[11px] uppercase tracking-wide text-white/60">Your Best</div>
              <div className="text-xl font-bold">{myBest}</div>
            </div>
            <div
              className="rounded-xl bg-white/5 border border-white/10 p-3 cursor-pointer"
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/leaderboard/${meta.id}`)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") navigate(`/leaderboard/${meta.id}`);
              }}
            >
              <div className="text-[11px] uppercase tracking-wide text-white/60">Top 5</div>
              <div className="text-sm">
                {loading && <div className="text-white/60">Loading…</div>}
                {error && <div className="text-red-400">{error}</div>}
                {!loading && !error && (
                  <ol className="space-y-1">
                    {top.slice(0, 5).map((r, i) => (
                      <li
                        key={`${r.name}-${i}`}
                        className="flex justify-between text-white/90"
                        onClick={() => navigate(`/leaderboard/${meta.id}`)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") navigate(`/leaderboard/${meta.id}`);
                        }}
                      >
                        <span className="truncate mr-3">{i + 1}. {r.name}</span>
                        <span className="font-mono">{r.score}</span>
                      </li>
                    ))}
                    {top.length === 0 && (
                      <li className="text-white/60">No scores yet.</li>
                    )}
                  </ol>
                )}
              </div>
            </div>
          </div>

          {/* CTAs */}
          <div className="mt-5 flex gap-3">
            <button
              type="button"
              className="flex-1 py-3 rounded-full font-extrabold text-base bg-gradient-to-r from-fuchsia-600 via-purple-600 to-sky-600 hover:from-fuchsia-500 hover:to-sky-500 shadow-lg"
              onClick={onPlay}
            >
              Play
            </button>
            <button
              type="button"
              className="px-4 py-3 rounded-full font-bold text-base bg-white/10 hover:bg-white/20 border border-white/15"
              onClick={handleShare}
              aria-label="Share this game"
            >
              Share
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
