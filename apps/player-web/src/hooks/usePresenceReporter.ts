import { useEffect } from "react";
import { reportPresence, type PresenceStatus } from "../lib/api";
import { useSharePresence } from "./useFriends";

/** The server counts you online for 2 minutes after each report. */
const HEARTBEAT_MS = 60 * 1000;

/**
 * Tells friends you're online, but only if you switched on "Show friends when I'm
 * online" in Settings (T7.6). With it off (the default) nothing is sent at all.
 * Friends see only "online": `status` and `gameId` are accepted for the pages that
 * pass them but are never sent.
 */
export function usePresenceReporter(
  args: { status?: PresenceStatus; gameId?: string; enabled?: boolean } = {},
) {
  const { sharePresence } = useSharePresence();
  const active = (args.enabled ?? true) && sharePresence;

  useEffect(() => {
    if (!active || typeof window === "undefined") return;
    let timer: number | undefined;
    const send = () => {
      if (document.visibilityState !== "visible") return;
      // Best-effort: the next heartbeat tries again.
      reportPresence().catch(() => undefined);
    };
    const beat = () => {
      send();
      timer = window.setTimeout(beat, HEARTBEAT_MS);
    };
    beat();
    document.addEventListener("visibilitychange", send);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", send);
    };
  }, [active]);
}
