import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { adminApi, type GameConfig, type GameStats } from "../../lib/api";

export function GameDrawer({ gameId, onClose }: { gameId: string | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [metadataText, setMetadataText] = useState("{}");
  const [metadataError, setMetadataError] = useState<string | null>(null);

  const gameQuery = useQuery({
    queryKey: ["admin-game", gameId],
    queryFn: () => (gameId ? adminApi.getGame(gameId) : Promise.resolve(null)),
    enabled: Boolean(gameId),
  });

  const statsQuery = useQuery({
    queryKey: ["admin-game-stats", gameId],
    queryFn: () => (gameId ? adminApi.getGameStats(gameId) : Promise.resolve(null)),
    enabled: Boolean(gameId),
  });

  useEffect(() => {
    if (gameQuery.data) {
      setMetadataText(JSON.stringify(gameQuery.data.metadata ?? {}, null, 2));
    }
  }, [gameQuery.data]);

  const updateMutation = useMutation({
    mutationFn: (metadata: Record<string, unknown> | null) => {
      if (!gameId) return Promise.reject(new Error("missing-game"));
      return adminApi.updateGameMetadata(gameId, metadata);
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ["admin-games"] });
      queryClient.setQueryData(["admin-game", gameId], data);
    },
  });

  if (!gameId) return null;
  const game = gameQuery.data;
  const stats = statsQuery.data;

  const handleSave = async () => {
    setMetadataError(null);
    let metadata: Record<string, unknown> | null;
    try {
      metadata = metadataText ? (JSON.parse(metadataText) as Record<string, unknown>) : null;
    } catch {
      setMetadataError("Metadata must be valid JSON");
      return;
    }
    await updateMutation.mutateAsync(metadata);
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/60">
      <div className="h-full w-full max-w-xl bg-slate-950">
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-slate-500">Configure Game</p>
            <h2 className="text-xl font-semibold text-white">{game?.title || gameId}</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-full border border-slate-800 p-2 text-slate-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="h-[calc(100%-73px)] overflow-y-auto px-6 py-6">
          {gameQuery.isLoading ? (
            <p className="text-sm text-slate-400">Loading…</p>
          ) : game ? (
            <div className="space-y-4">
              <UsagePanel stats={stats ?? null} loading={statsQuery.isLoading} />
              <ReadOnlySummary game={game} />
              <Field label="Metadata (JSON)">
                <textarea
                  value={metadataText}
                  onChange={(e) => setMetadataText(e.target.value)}
                  rows={6}
                  className="w-full rounded-xl border border-slate-800 bg-transparent px-3 py-2 text-sm font-mono focus:border-brand-500 focus:outline-none"
                />
                {metadataError && <p className="mt-1 text-xs text-rose-400">{metadataError}</p>}
                {updateMutation.isError && (
                  <p className="mt-1 text-xs text-rose-400">
                    Save failed: {updateMutation.error.message}
                  </p>
                )}
              </Field>
              <button
                onClick={handleSave}
                disabled={updateMutation.isPending}
                className="w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold uppercase tracking-[0.3em] text-white disabled:opacity-60"
              >
                Save Changes
              </button>
            </div>
          ) : (
            <p className="text-sm text-rose-300">Game not found.</p>
          )}
        </div>
      </div>
    </div>
  );
}

/** Seeded from the game manifest on deploy, so shown but not editable. */
function ReadOnlySummary({ game }: { game: GameConfig }) {
  const rows = [
    { label: "Status", value: game.status },
    { label: "XP multiplier", value: game.xpMultiplier.toFixed(2) },
    { label: "Max score", value: game.maxScore.toLocaleString() },
    { label: "Max score / s", value: game.maxScorePerSecond.toLocaleString() },
  ];
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-300">
      {game.description && <p className="mb-3 text-slate-400">{game.description}</p>}
      <dl className="grid grid-cols-2 gap-2">
        {rows.map((row) => (
          <div key={row.label}>
            <dt className="text-[0.6rem] uppercase tracking-[0.3em] text-slate-500">{row.label}</dt>
            <dd className="text-white">{row.value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs text-slate-500">
        These come from the game manifest. Change them in the game folder and redeploy.
      </p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.3em] text-slate-500">{label}</p>
      <div className="mt-2 text-sm text-slate-300">{children}</div>
    </div>
  );
}

function UsagePanel({ stats, loading }: { stats: GameStats | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-400">
        Loading usage stats…
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-400">
        No usage data available yet.
      </div>
    );
  }

  const summary = [
    { label: "Plays (28d)", value: stats.totalPlays.toLocaleString() },
    { label: "Avg Score", value: stats.averageScore.toFixed(2) },
    { label: "Unique Players", value: stats.uniquePlayers.toLocaleString() },
  ];
  const maxWeeklyCount = Math.max(1, ...stats.weeklyBreakdown.map((bucket) => bucket.count));

  return (
    <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Usage Insights</p>
        <span className="text-xs text-slate-500">
          Since {new Date(stats.since).toLocaleDateString()}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-3 text-center text-white">
        {summary.map((item) => (
          <div key={item.label} className="rounded-xl bg-slate-950/60 px-3 py-4">
            <p className="text-lg font-semibold">{item.value}</p>
            <p className="text-[0.6rem] uppercase tracking-[0.3em] text-slate-500">{item.label}</p>
          </div>
        ))}
      </div>
      <div className="space-y-2">
        {stats.weeklyBreakdown.map((bucket) => (
          <div key={bucket.start} className="text-xs text-slate-300">
            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-200">Week of {bucket.label}</span>
              <span className="text-slate-400">{bucket.count} plays</span>
            </div>
            <div className="mt-1 h-2 w-full rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-brand-500"
                style={{ width: `${((bucket.count / maxWeeklyCount) * 100).toFixed(1)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
