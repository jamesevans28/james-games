import { useEffect } from "react";
import { useAuth } from "../context/FirebaseAuthProvider";
import { postHighScore } from "../lib/api";
import { flushQueue, outcomeForError, readQueue } from "../lib/scoreQueue";
import { adapters } from "../platform/adapters";

/**
 * Sends runs saved while offline (T10.4): once signed in, and again whenever the
 * connection comes back. Mounted once, in App.
 */
export function useScoreQueueFlusher(): void {
  const { user } = useAuth();
  const signedIn = Boolean(user);

  useEffect(() => {
    if (!signedIn) return;
    const flush = () => {
      if (!adapters.network.isOnline() || readQueue().length === 0) return;
      void flushQueue(async (run) => {
        try {
          await postHighScore(run);
          return "sent";
        } catch (err) {
          return outcomeForError(err);
        }
      });
    };
    flush();
    return adapters.network.onChange((online) => {
      if (online) flush();
    });
  }, [signedIn]);
}
