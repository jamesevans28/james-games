import type { AudioKit } from "../sdk";
import { unlockAudio } from "./context";
import { isMuted } from "./mute";
import { synth } from "./synth";

export { isMuted, setMuted, onMutedChange } from "./mute";
export { unlockAudio } from "./context";

/**
 * The audio kit games get as `host.audio`. Named effects fall back to synth sounds
 * until a game ships recorded SFX (T4.7 adds the loader).
 */
export function createAudioKit(): AudioKit {
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
      unlockAudio();
      synth.beep(freq, ms);
    },
    ding: () => {
      unlockAudio();
      synth.ding();
    },
    thud: () => {
      unlockAudio();
      synth.thud();
    },
    pop: () => {
      unlockAudio();
      synth.pop();
    },
    play: (name) => {
      unlockAudio();
      (named[name] ?? synth.pop)();
    },
  };
}
