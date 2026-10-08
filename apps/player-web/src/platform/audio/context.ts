/**
 * One AudioContext for the whole app. It is created only from a real user
 * gesture (the first tap or key press anywhere), so browsers never warn about
 * autoplay. Before that, sounds are silently skipped. Never throws: no audio is
 * better than a crashed game.
 */
let ctx: AudioContext | null = null;
let listening = false;

type AudioContextCtor = typeof AudioContext;

/** The context if a gesture has created it, else null. Never creates one. */
export function getAudioContext(): AudioContext | null {
  return ctx;
}

/** Create (first time) and resume the context. Call only from a user gesture. */
export function unlockAudio(): void {
  try {
    if (!ctx) {
      const Ctor: AudioContextCtor | undefined =
        typeof window === "undefined"
          ? undefined
          : (window.AudioContext ??
            (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext);
      if (!Ctor) return;
      ctx = new Ctor();
    }
    if (ctx.state === "suspended") void ctx.resume().catch(() => undefined);
  } catch {
    // unsupported: stay silent
  }
}

/** Unlock audio on the first tap or key press (idempotent). */
export function listenForAudioUnlock(): void {
  if (listening || typeof window === "undefined") return;
  listening = true;
  const onGesture = () => {
    unlockAudio();
    if (ctx?.state === "running") {
      window.removeEventListener("pointerdown", onGesture, true);
      window.removeEventListener("keydown", onGesture, true);
    }
  };
  window.addEventListener("pointerdown", onGesture, true);
  window.addEventListener("keydown", onGesture, true);
}
