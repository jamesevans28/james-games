import { useEffect } from "react";
import { updatePresenceStatus, PresenceStatus } from "../lib/api";
import { useAuth } from "../context/FirebaseAuthProvider";

const HEARTBEAT_MS = 30 * 1000;

export function usePresenceReporter(args: {
  status: PresenceStatus;
  gameId?: string;
  gameTitle?: string;
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
          gameTitle: args.gameTitle,
        });
      } catch (err: any) {
        if (import.meta.env.DEV) {
          console.debug("presence heartbeat failed", err);
        }
      } finally {
        if (!cancelled) {
          timeoutId = window.setTimeout(send, HEARTBEAT_MS);
        }
      }
    };

    send();
    return () => {
      cancelled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [user?.userId, initialized, args.status, args.gameId, args.gameTitle, args.enabled]);
}
