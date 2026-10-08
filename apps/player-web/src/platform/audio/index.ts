import type { AudioKit } from "../sdk";
import { listenForAudioUnlock } from "./context";
import { isMuted } from "./mute";
import { createSfxBank } from "./sfx";
import { synth } from "./synth";

export { isMuted, setMuted, onMutedChange } from "./mute";
export { unlockAudio, listenForAudioUnlock } from "./context";

/**
 * The audio kit games get as `host.audio`. `play(name)` uses the game's recorded
 * effect (manifest `sfx`, files in public/assets/<id>/sfx/) when it has loaded,
 * otherwise a synth sound. Everything respects the global mute.
 */
export function createAudioKit(gameId = "", sfxNames: readonly string[] = []): AudioKit {
  listenForAudioUnlock();
  const bank = createSfxBank(gameId, sfxNames);
  const named: Record<string, () => void> = {
    hit: synth.pop,
    score: synth.ding,
    miss: synth.thud,
    end: synth.thud,
    tap: () => synth.beep(),
  };
  return {
    get muted() {
      return isMuted();
    },
    beep: (freq, ms) => {
      synth.beep(freq, ms);
    },
    ding: () => {
      synth.ding();
    },
    thud: () => {
      synth.thud();
    },
    pop: () => {
      synth.pop();
    },
    play: (name) => {
      if (bank.play(name)) return;
      (named[name] ?? synth.pop)();
    },
  };
}
