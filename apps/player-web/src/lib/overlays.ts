/**
 * Overlay discipline (T7.11): at most one overlay at a time, the most important
 * first. Components ask for a slot with `useOverlaySlot(id, wantsToShow)` and render
 * only when it returns true. In-game overlays (pause, game over, stickers) live
 * inside the game page, so app-level hints stay off game routes.
 */
import { useEffect, useSyncExternalStore } from "react";

export type OverlayId = "update" | "install" | "ios-install";

/** Higher wins. */
const PRIORITY: Record<OverlayId, number> = { update: 3, install: 1, "ios-install": 1 };

/** Dismissed hints stay away this long (`g4j:dismiss:<id>`). */
export const DISMISS_FOR_MS = 14 * 24 * 60 * 60 * 1000;

/** Install hints appear from this visit on (one visit per browser session). */
export const INSTALL_HINT_FROM_VISIT = 2;

/** The overlay to show among those that want to, or null. Ties keep the first asker. */
export function pickOverlay(wanting: readonly OverlayId[]): OverlayId | null {
  let best: OverlayId | null = null;
  for (const id of wanting) {
    if (best === null || PRIORITY[id] > PRIORITY[best]) best = id;
  }
  return best;
}

/** True while a dismissal stored at `dismissedAt` (ms) is still in force. */
export function isStillDismissed(dismissedAt: number | null, now: number): boolean {
  return dismissedAt !== null && Number.isFinite(dismissedAt) && now - dismissedAt < DISMISS_FOR_MS;
}

const dismissKey = (id: OverlayId) => `g4j:dismiss:${id}`;

export function readDismissedAt(id: OverlayId): number | null {
  try {
    const raw = localStorage.getItem(dismissKey(id));
    return raw === null ? null : Number(raw);
  } catch {
    return null;
  }
}

export function dismissOverlay(id: OverlayId, now = Date.now()): void {
  try {
    localStorage.setItem(dismissKey(id), String(now));
  } catch {
    // Storage blocked: the hint may come back next visit.
  }
}

const VISITS_KEY = "g4j:visits";
const VISIT_COUNTED_KEY = "g4j:visitCounted";

/** Counts this browser session once and returns the visit number (1 = first visit). */
export function countVisit(): number {
  try {
    const seen = Number(localStorage.getItem(VISITS_KEY)) || 0;
    if (sessionStorage.getItem(VISIT_COUNTED_KEY) === "1") return seen;
    sessionStorage.setItem(VISIT_COUNTED_KEY, "1");
    localStorage.setItem(VISITS_KEY, String(seen + 1));
    return seen + 1;
  } catch {
    return 1;
  }
}

// --- the shared slot ---------------------------------------------------------

let wanting: OverlayId[] = [];
const listeners = new Set<() => void>();

function setWanting(id: OverlayId, wants: boolean) {
  const has = wanting.includes(id);
  if (wants === has) return;
  wanting = wants ? [...wanting, id] : wanting.filter((w) => w !== id);
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const activeOverlay = () => pickOverlay(wanting);

/** True when overlay `id` wants to show and nothing more important does. */
export function useOverlaySlot(id: OverlayId, wantsToShow: boolean): boolean {
  useEffect(() => {
    setWanting(id, wantsToShow);
    return () => setWanting(id, false);
  }, [id, wantsToShow]);
  const active = useSyncExternalStore(subscribe, activeOverlay, activeOverlay);
  return wantsToShow && active === id;
}
