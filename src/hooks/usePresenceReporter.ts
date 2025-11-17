import { useEffect } from "react";
import { updatePresenceStatus, PresenceStatus } from "../lib/api";
import { useAuth } from "../context/AuthProvider";

const HEARTBEAT_MS = 30 * 1000;

export function usePresenceReporter(args: {
  status: PresenceStatus;
  gameId?: string;
  gameTitle?: string;
  enabled?: boolean;
}) {
  const { user } = useAuth();
  useEffect(() => {
    if (typeof window === "undefined") return;
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
  }, [user?.userId, args.status, args.gameId, args.gameTitle, args.enabled]);
}
