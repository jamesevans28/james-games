import { useEffect, useState } from "react";
import { markPrompted, readRatingPromptState, shouldPromptRating } from "../lib/ratingPrompt";

type Snapshot = { gameId: string; plays: number; lastPromptAt: number | null; now: number };

function snapshot(gameId: string): Snapshot {
  return { gameId, ...readRatingPromptState(gameId), now: Date.now() };
}

/**
 * Whether to show the rating prompt on a game's landing page (T7.4).
 *
 * The decision is made from the play count when the page opens, never from a run that
 * just ended, so finishing a run, Play again and Close can't trigger it. `enabled` is
 * false while a game is running or once a run has finished on this visit.
 */
export function useRatingPrompt({
  gameId,
  enabled,
  canRate,
  ready,
  alreadyRated,
}: {
  gameId: string;
  /** Landing page visible and no run finished yet on this visit. */
  enabled: boolean;
  /** Signed in (rating needs an account). */
  canRate: boolean;
  /** The rating summary loaded, so we know whether they've rated. */
  ready: boolean;
  alreadyRated: boolean;
}) {
  const [snap, setSnap] = useState(() => snapshot(gameId));
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);
  // A different game in the same page: take a fresh snapshot (React's "adjust state
  // while rendering" pattern, no effect needed).
  if (snap.gameId !== gameId) setSnap(snapshot(gameId));

  const open =
    enabled &&
    canRate &&
    ready &&
    !alreadyRated &&
    dismissedFor !== gameId &&
    snap.gameId === gameId &&
    shouldPromptRating(snap);

  // Remember the ask as soon as it shows, so a reload doesn't ask again.
  useEffect(() => {
    if (open) markPrompted(gameId, Date.now());
  }, [open, gameId]);

  return { open, dismiss: () => setDismissedFor(gameId) };
}
