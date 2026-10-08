import { Link } from "react-router";
import { ProfileAvatar } from "../../../components/profile";
import { useLeaderboard } from "../../../hooks/useLeaderboard";
import { getBest } from "../../../platform/storage/bestScore";

const TOP = 5;

/**
 * Your best on this device, then the top 5. Every state has a calm empty: loading,
 * offline / API down, and no scores yet.
 */
export default function LandingScores({ gameId }: { gameId: string }) {
  const board = useLeaderboard(gameId, { limit: TOP });
  // Read on every render: PlayGame re-renders the landing after each run.
  const best = getBest(gameId);

  return (
    <section className="card mt-6 p-5" aria-labelledby="scores">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="scores" className="font-display text-xl font-extrabold text-ink">
          Top scores
        </h2>
        <Link
          to={`/leaderboard/${gameId}`}
          className="inline-flex min-h-11 items-center text-base font-bold text-brand underline"
        >
          See all
        </Link>
      </div>
      <p className="mt-1 text-base text-ink-2">
        Your best:{" "}
        <span className="font-extrabold text-ink">
          {best > 0 ? best.toLocaleString() : "not yet"}
        </span>
      </p>

      {board.isPending && board.fetchStatus !== "idle" ? (
        <ol className="mt-3 space-y-2" aria-hidden>
          {Array.from({ length: 3 }, (_, i) => (
            <li key={i} className="h-11 rounded-xl bg-paper-2" />
          ))}
        </ol>
      ) : board.data && board.data.length > 0 ? (
        <ol className="mt-3 divide-y divide-line">
          {board.data.slice(0, TOP).map((row, i) => (
            <li key={`${i}-${row.screenName}`} className="flex min-h-11 items-center gap-3 py-1.5">
              <span className="w-6 text-base font-extrabold text-ink-3">{i + 1}</span>
              <ProfileAvatar
                user={{ avatar: row.avatar }}
                size={32}
                borderWidth={2}
                strokeWidth={1}
              />
              {row.userId ? (
                <Link
                  to={`/profile/${row.userId}`}
                  className="min-w-0 flex-1 truncate text-base font-bold text-ink"
                >
                  {row.screenName}
                </Link>
              ) : (
                <span className="min-w-0 flex-1 truncate text-base font-bold text-ink">
                  {row.screenName}
                </span>
              )}
              <span className="font-mono text-base font-extrabold text-brand">
                {row.score.toLocaleString()}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-3 text-base text-ink-2">
          {board.isError || board.fetchStatus === "paused"
            ? "Scores will show up here when you're online."
            : "No scores yet. Yours could be the first!"}
        </p>
      )}
    </section>
  );
}
