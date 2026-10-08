import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function getSnapshot(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia && window.matchMedia(QUERY).matches;
}

/** True when the player asked their device for less motion. */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
