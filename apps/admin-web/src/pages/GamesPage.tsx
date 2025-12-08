import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Gamepad2, Plus } from "lucide-react";
import { adminApi, GameConfig, PaginatedResponse } from "../lib/api";
import { GameDrawer } from "../components/games/GameDrawer";
import { CreateGameModal } from "../components/games/CreateGameModal";

export function GamesPage() {
  const [cursorStack, setCursorStack] = useState<Array<string | undefined>>([undefined]);
  const [selectedGame, setSelectedGame] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const currentCursor = cursorStack[cursorStack.length - 1];

  const queryKey = useMemo(() => ["admin-games", currentCursor], [currentCursor]);

  const gamesQuery = useQuery<PaginatedResponse<GameConfig>>({
    queryKey,
    queryFn: () => adminApi.listGames({ cursor: currentCursor, limit: 25 }),
    placeholderData: (prev) => prev,
  });

  const games = gamesQuery.data?.items ?? [];
  const nextCursor = gamesQuery.data?.nextCursor;

  const goNext = () => {
    if (nextCursor) setCursorStack((stack) => [...stack, nextCursor]);
  };
  const goPrev = () => {
    if (cursorStack.length > 1) setCursorStack((stack) => stack.slice(0, -1));
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 rounded-3xl border border-white/5 bg-slate-950/70 p-6 backdrop-blur lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.45em] text-slate-500">Content Pipeline</p>
          <h2 className="text-2xl font-semibold text-white">Games</h2>
          <p className="text-sm text-slate-400">
            Edit metadata, XP multipliers, and beta visibility.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 rounded-2xl bg-brand-600 px-5 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-white"
        >
          <Plus className="h-4 w-4" /> Add Game
        </button>
      </header>

      <div className="rounded-3xl border border-white/5 bg-slate-950/60 p-5 backdrop-blur">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {games.map((game) => (
            <GameCard key={game.gameId} game={game} onSelect={() => setSelectedGame(game.gameId)} />
          ))}
        </div>
        {!games.length && !gamesQuery.isFetching && (
          <p className="py-10 text-center text-sm text-slate-400">No games found.</p>
        )}
        {gamesQuery.isFetching && <p className="mt-4 text-xs text-slate-500">Refreshing…</p>}
        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={goPrev}
            disabled={cursorStack.length <= 1 || gamesQuery.isFetching}
            className="rounded-xl border border-slate-800 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-200 disabled:opacity-40"
          >
            Prev
          </button>
          <button
            onClick={goNext}
            disabled={!nextCursor || gamesQuery.isFetching}
            className="rounded-xl bg-brand-600 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>

      {selectedGame && <GameDrawer gameId={selectedGame} onClose={() => setSelectedGame(null)} />}
      <CreateGameModal open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  );
}

function GameCard({ game, onSelect }: { game: GameConfig; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className="flex flex-col rounded-2xl border border-slate-900 bg-slate-900/70 p-4 text-left text-white transition hover:border-brand-500/60 hover:bg-slate-900"
    >
      <div className="flex items-center gap-3">
        <Gamepad2 className="h-5 w-5 text-brand-400" />
        <p className="text-lg font-semibold">{game.title}</p>
      </div>
      <p className="mt-2 line-clamp-2 text-sm text-slate-400">
        {game.description || "No description"}
      </p>
      <div className="mt-4 flex flex-wrap gap-2 text-xs uppercase tracking-widest">
        <span className="rounded-full border border-slate-800 px-3 py-1 text-slate-300">
          XP × {game.xpMultiplier?.toFixed?.(2) ?? "1.00"}
        </span>
        <span className="rounded-full border border-slate-800 px-3 py-1 text-slate-300">
          {game.betaOnly ? "Beta" : "Public"}
        </span>
      </div>
    </button>
  );
}
