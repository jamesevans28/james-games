import { useEffect, useRef, useState } from "react";
import { postHighScore, type ScoreSubmissionResult } from "../../../lib/api";
import { enqueueRun, newPlayId, outcomeForError } from "../../../lib/scoreQueue";
import { useAuth } from "../../../context/FirebaseAuthProvider";

/**
 * skipped: nothing to save (no account, no game, or a score of 0)
 * saving → saved | queued (offline: kept on the device, sent later; T10.4) | failed
 */
export type RunSubmissionStatus = "skipped" | "saving" | "saved" | "queued" | "failed";

export type RunSubmission = {
  status: RunSubmissionStatus;
  result: ScoreSubmissionResult | null;
  /** A short, soft message for the player, or null. */
  error: string | null;
};

type Run = { gameId?: string | null; score: number | null; durationMs?: number };

/**
 * Posts one finished run to POST /scores exactly once for the lifetime of the
 * calling component (GameOverDialog mounts a fresh panel for every run). If the
 * network is down, the run goes into the offline queue with its play id and is sent
 * later (useScoreQueueFlusher); a refusal from the server just reports "failed".
 */
export function useRunSubmission({ gameId, score, durationMs }: Run): RunSubmission {
  const { user, refreshProfile } = useAuth();
  const s = Number(score) || 0;
  const eligible = Boolean(user && gameId && s > 0);
  const postedRef = useRef(false);
  const [state, setState] = useState<{
    status: "idle" | "saved" | "queued" | "failed" | "skipped";
    result: ScoreSubmissionResult | null;
  }>({ status: "idle", result: null });

  useEffect(() => {
    if (!eligible || !gameId || postedRef.current) return;
    postedRef.current = true;
    // No cancel on unmount: React ignores late updates, and StrictMode's
    // test unmount must not drop the one and only response.
    const run = {
      playId: newPlayId(),
      gameId,
      score: s,
      durationMs,
      tzOffsetMinutes: -new Date().getTimezoneOffset(),
    };
    postHighScore(run)
      .then((result) => {
        if (!result) {
          setState({ status: "skipped", result: null });
          return;
        }
        setState({ status: "saved", result });
        void refreshProfile();
      })
      .catch((err: unknown) => {
        if (outcomeForError(err) === "retry") {
          enqueueRun({ ...run, queuedAt: Date.now() });
          setState({ status: "queued", result: null });
        } else {
          setState({ status: "failed", result: null });
        }
      });
  }, [eligible, gameId, s, durationMs, refreshProfile]);

  const status: RunSubmissionStatus =
    state.status === "idle" ? (eligible ? "saving" : "skipped") : state.status;
  return {
    status,
    result: state.result,
    error:
      status === "failed"
        ? "Couldn't save this score"
        : status === "queued"
          ? "Saved on this device. We'll send it when you're back online."
          : null,
  };
}
