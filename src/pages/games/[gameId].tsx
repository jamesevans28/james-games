import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { games } from "../../games";
import GameHeader from "./GameHeader";
import { trackGameStart } from "../../utils/analytics";

export default function PlayGame() {
  const { gameId } = useParams();
  const meta = useMemo(() => games.find((g) => g.id === gameId), [gameId]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cleanup: (() => void) | null = null;

    const start = async () => {
      if (!meta) {
        setError("Game not found");
        return;
      }
      if (!containerRef.current) return;
      try {
        const mod = await meta.load();
        const { destroy } = mod.mount(containerRef.current);
        // Track initial game start when the game is mounted
        trackGameStart(meta.id, meta.title);
        cleanup = destroy;
      } catch (e) {
        console.error(e);
        setError("Failed to load game");
      }
    };

    start();
    return () => {
      if (cleanup) cleanup();
    };
  }, [meta]);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <GameHeader title={meta?.title ?? "Unknown Game"} />

      {error ? (
        <div className="p-4 text-red-400">{error}</div>
      ) : (
        <div className="game-stage">
          <div
            ref={containerRef}
            id="game-container"
            className="relative w-full h-full overflow-hidden bg-black"
          />
        </div>
      )}
    </div>
  );
}
