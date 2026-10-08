import { getAudioContext } from "./context";
import { isMuted } from "./mute";

/**
 * Recorded sound effects for one game: public/assets/<gameId>/sfx/<name>.mp3
 * (the Phase 8 AI sounds, or the kids' own recordings). Loading starts on the
 * first play after a tap; a missing or broken file just means the synth
 * fallback keeps playing. Buffers are cached per URL for the app's lifetime.
 */
const cache = new Map<string, Promise<AudioBuffer | null>>();

export const sfxUrl = (gameId: string, name: string) => `/assets/${gameId}/sfx/${name}.mp3`;

function load(url: string): Promise<AudioBuffer | null> | null {
  const ctx = getAudioContext();
  if (!ctx) return null; // not unlocked yet: try again on a later play
  let pending = cache.get(url);
  if (!pending) {
    pending = (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) return null;
        return await ctx.decodeAudioData(await res.arrayBuffer());
      } catch {
        return null;
      }
    })();
    cache.set(url, pending);
  }
  return pending;
}

export type SfxBank = {
  /** Plays `name` if its file has loaded; returns false so the caller can fall back. */
  play(name: string): boolean;
  /** Start fetching (call after a user gesture). */
  preload(): void;
};

export function createSfxBank(gameId: string, names: readonly string[]): SfxBank {
  const ready = new Map<string, AudioBuffer>();
  let started = false;
  const preload = () => {
    if (started || names.length === 0 || !getAudioContext()) return;
    started = true;
    names.forEach((name) => {
      void load(sfxUrl(gameId, name))?.then((buffer) => {
        if (buffer) ready.set(name, buffer);
      });
    });
  };
  return {
    preload,
    play(name) {
      preload();
      const buffer = ready.get(name);
      const ctx = getAudioContext();
      if (!buffer || !ctx || isMuted()) return Boolean(buffer);
      try {
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        src.connect(ctx.destination);
        src.start();
      } catch {
        // decoration only
      }
      return true;
    },
  };
}
