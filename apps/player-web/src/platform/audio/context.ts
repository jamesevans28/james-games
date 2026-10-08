/**
 * One AudioContext for the whole app, created lazily on the first sound after a
 * user gesture (browsers block audio before that). Never throws: no audio is
 * better than a crashed game.
 */
let ctx: AudioContext | null = null;

type AudioContextCtor = typeof AudioContext;

export function getAudioContext(): AudioContext | null {
  if (ctx) return ctx;
  try {
    const Ctor: AudioContextCtor | undefined =
      typeof window === "undefined"
        ? undefined
        : (window.AudioContext ??
          (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext);
    if (!Ctor) return null;
    ctx = new Ctor();
  } catch {
    return null;
  }
  return ctx;
}

/** Resume a suspended context (iOS suspends it until a tap). Safe to call often. */
export function unlockAudio(): void {
  const c = getAudioContext();
  if (c && c.state === "suspended") void c.resume().catch(() => undefined);
}
