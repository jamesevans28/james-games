import { useEffect, useState } from "react";
import { adapters } from "../../../platform/adapters";
import { useCatalog } from "../../../context/GameCatalogProvider";
import { shareDataFor } from "./shareScore";

const FEEDBACK: Partial<Record<string, string>> = {
  copied: "Link copied!",
  failed: "Try again",
};

/**
 * "Share" on game over (T11.5): the share sheet (or the clipboard) with the
 * score's /s/<playId> link, whose preview card shows the score. Shown only once
 * the run is saved, because the link needs the server's play id.
 */
export default function ShareScoreButton({
  playId,
  score,
  gameId,
  className = "btn btn-outline min-h-11 self-center px-6 py-2 text-sm",
}: {
  playId: string;
  score: number;
  gameId?: string | null;
  className?: string;
}) {
  const { getGame } = useCatalog();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!feedback) return;
    const t = window.setTimeout(() => setFeedback(null), 2500);
    return () => window.clearTimeout(t);
  }, [feedback]);

  const onShare = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const gameTitle = gameId ? getGame(gameId)?.title : undefined;
      const result = await adapters.share.share(shareDataFor({ playId, score, gameTitle }));
      setFeedback(FEEDBACK[result] ?? null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" className={className} onClick={() => void onShare()} disabled={busy}>
        {feedback ?? "Share your score"}
      </button>
      {/* Out of flow (sr-only is absolute), so it adds no gap to the dialog's button column. */}
      <span className="sr-only" role="status">
        {feedback ?? ""}
      </span>
    </>
  );
}
