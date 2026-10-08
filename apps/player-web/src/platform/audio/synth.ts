import { getAudioContext } from "./context";
import { isMuted } from "./mute";

type Tone = { freq: number; ms: number; type?: OscillatorType; volume?: number; slideTo?: number };

/** Plays one short synthesized tone. Silent when muted or audio is unavailable. */
export function tone({ freq, ms, type = "sine", volume = 0.15, slideTo }: Tone): void {
  if (isMuted()) return;
  const ctx = getAudioContext();
  if (!ctx || ctx.state !== "running") return;
  try {
    const t0 = ctx.currentTime;
    const t1 = t0 + ms / 1000;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t1);
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t1);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t1 + 0.02);
  } catch {
    // ignore: audio is decoration
  }
}

export const synth = {
  beep: (freq = 660, ms = 90) => tone({ freq, ms, type: "square", volume: 0.08 }),
  ding: () => tone({ freq: 880, ms: 220, slideTo: 1320 }),
  thud: () => tone({ freq: 160, ms: 180, type: "triangle", volume: 0.25, slideTo: 60 }),
  pop: () => tone({ freq: 520, ms: 70, type: "triangle", slideTo: 900 }),
};
