/** Global mute, remembered on this device under `g4j:muted`. */
const KEY = "g4j:muted";
const listeners = new Set<(muted: boolean) => void>();

function read(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

let muted = read();

export function isMuted(): boolean {
  return muted;
}

export function setMuted(next: boolean): void {
  muted = next;
  try {
    localStorage.setItem(KEY, next ? "1" : "0");
  } catch {
    // storage unavailable: the setting just won't persist
  }
  listeners.forEach((fn) => fn(next));
}

export function onMutedChange(fn: (muted: boolean) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
