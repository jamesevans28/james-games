import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { games } from "../../games";
import GameHeader from "./GameHeader";
import { trackGameStart } from "../../utils/analytics";
import Seo from "../../components/Seo";

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
      <Seo
        title={meta ? `${meta.title} — Play Free at Games4James` : "Play Free Games at Games4James"}
        description={
          meta?.description ||
          "Play free online games made by James. Fun, fast, skill-based games you can play instantly on your phone or browser."
        }
        url={`https://games4james.com/games/${meta?.id ?? ""}`}
        canonical={`https://games4james.com/games/${meta?.id ?? ""}`}
        image={
          meta?.thumbnail
            ? `https://games4james.com${meta.thumbnail}`
            : "https://games4james.com/assets/logo.png"
        }
      />
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
