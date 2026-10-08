import { useEffect } from "react";
import { updatePresenceStatus, type PresenceStatus } from "../lib/api";
import { useAuth } from "../context/FirebaseAuthProvider";

const HEARTBEAT_MS = 30 * 1000;

export function usePresenceReporter(args: {
  status: PresenceStatus;
  gameId?: string;
  enabled?: boolean;
}) {
  const { user, initialized } = useAuth();
  useEffect(() => {
    if (typeof window === "undefined") return;
    // Wait for auth to be initialized before making API calls
    if (!initialized) return;
    if (!user || !args.enabled) return;
    let cancelled = false;
    let timeoutId: number | null = null;

    const send = async () => {
      try {
        await updatePresenceStatus({
          status: args.status,
          gameId: args.gameId,
        });
      } catch {
        // Presence is best-effort: the next heartbeat tries again.
      } finally {
        if (!cancelled) {
          timeoutId = window.setTimeout(send, HEARTBEAT_MS);
        }
      }
    };

    void send();
    return () => {
      cancelled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [user?.userId, initialized, args.status, args.gameId, args.enabled]);
}
