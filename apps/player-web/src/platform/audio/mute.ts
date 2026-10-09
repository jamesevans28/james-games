import { adapters } from "../adapters";

/** Global mute, remembered on this device under `g4j:muted`. */
const KEY = "g4j:muted";
const listeners = new Set<(muted: boolean) => void>();

function read(): boolean {
  return adapters.storage.get(KEY) === "1";
}

let muted = read();

export function isMuted(): boolean {
  return muted;
}

export function setMuted(next: boolean): void {
  muted = next;
  adapters.storage.set(KEY, next ? "1" : "0"); // may not persist if storage is blocked
  listeners.forEach((fn) => fn(next));
}

export function onMutedChange(fn: (muted: boolean) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
