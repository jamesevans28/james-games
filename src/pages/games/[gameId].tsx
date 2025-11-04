import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { games } from "../../games";
import GameHeader from "./GameHeader";
import { trackGameStart } from "../../utils/analytics";
import { getUserName, setUserName } from "../../utils/user";
import NameDialog from "../../components/NameDialog";
import Seo from "../../components/Seo";
import GameLanding from "../../components/GameLanding";
import ScoreDialog from "../../components/ScoreDialog";
import { onGameOver } from "../../utils/gameEvents";

export default function PlayGame() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const meta = useMemo(() => games.find((g) => g.id === gameId), [gameId]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const destroyRef = useRef<null | (() => void)>(null);
  const [error, setError] = useState<string | null>(null);
  const [askName, setAskName] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [showScore, setShowScore] = useState(false);
  const [lastScore, setLastScore] = useState<number | null>(null);

  useEffect(() => {
    if (!getUserName()) setAskName(true);
    // Listen for game over to return to landing and show score dialog
    const off = onGameOver((d) => {
      if (!meta || d.gameId !== meta.id) return;
      // Unmount the game and show dialog
      if (destroyRef.current) {
        try {
          destroyRef.current();
        } catch {}
        destroyRef.current = null;
      }
      setPlaying(false);
      setLastScore(d.score);
      setShowScore(true);
    });
    return () => {
      off?.();
    };
  }, [meta]);

  // Mount/unmount when playing toggles
  useEffect(() => {
    let canceled = false;
    const doMount = async () => {
      if (!playing) return;
      if (!meta) {
        setError("Game not found");
        return;
      }
      if (!containerRef.current) return;
      try {
        const mod = await meta.load();
        if (canceled) return;
        const { destroy } = mod.mount(containerRef.current);
        destroyRef.current = destroy;
        trackGameStart(meta.id, meta.title);
      } catch (e) {
        console.error(e);
        setError("Failed to load game");
      }
    };
    doMount();
    return () => {
      canceled = true;
      if (destroyRef.current) {
        try {
          destroyRef.current();
        } catch {}
        destroyRef.current = null;
      }
    };
  }, [playing, meta]);

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
      <GameHeader
        title={meta?.title ?? "Unknown Game"}
        leaderboardTo={meta ? `/leaderboard/${meta.id}` : undefined}
      />

      {error && <div className="p-4 text-red-400">{error}</div>}
      {!playing && meta && !error && <GameLanding meta={meta} onPlay={() => setPlaying(true)} />}
      {playing && (
        <div className="game-stage">
          <div
            ref={containerRef}
            id="game-container"
            className="relative w-full h-full overflow-hidden bg-black"
          />
        </div>
      )}
      {askName && (
        <NameDialog
          initialValue={""}
          onCancel={() => setAskName(false)}
          onSave={(v) => {
            const t = v.trim();
            if (t) setUserName(t);
            setAskName(false);
          }}
        />
      )}
      <ScoreDialog
        open={showScore}
        score={lastScore}
        onClose={() => setShowScore(false)}
        onPlayAgain={() => {
          setShowScore(false);
          setPlaying(true);
        }}
        onViewLeaderboard={meta ? () => navigate(`/leaderboard/${meta.id}`) : undefined}
      />
    </div>
  );
}
