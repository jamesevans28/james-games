import { FormEvent, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { adminApi } from "../../lib/api";

export function CreateGameModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [gameId, setGameId] = useState("");
  const [title, setTitle] = useState("");
  const [thumbnail, setThumbnail] = useState("/assets/game-id/thumbnail.svg");
  const mutation = useMutation({
    mutationFn: () =>
      adminApi.createGame({
        gameId,
        title,
        thumbnail,
        description: "",
        objective: "",
        controls: "",
        xpMultiplier: 1,
        betaOnly: false,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-games"] });
      setGameId("");
      setTitle("");
      onClose();
    },
  });

  if (!open) return null;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    mutation.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-950 p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-slate-500">New Game</p>
            <h2 className="text-xl font-semibold text-white">Register Config Entry</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-full border border-slate-800 p-2 text-slate-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs uppercase tracking-[0.3em] text-slate-500">Game ID</label>
            <input
              value={gameId}
              onChange={(e) => setGameId(e.target.value)}
              required
              className="mt-2 w-full rounded-xl border border-slate-800 bg-transparent px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              placeholder="snake-attack"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-[0.3em] text-slate-500">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="mt-2 w-full rounded-xl border border-slate-800 bg-transparent px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-[0.3em] text-slate-500">
              Thumbnail Path
            </label>
            <input
              value={thumbnail}
              onChange={(e) => setThumbnail(e.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-800 bg-transparent px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
          </div>
          {mutation.isError && (
            <p className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm text-rose-200">
              Failed to create game entry.
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-800 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!gameId || !title || mutation.isPending}
              className="rounded-xl bg-brand-600 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white disabled:opacity-60"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
