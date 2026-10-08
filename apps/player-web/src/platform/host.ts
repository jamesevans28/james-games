import { BRAND_COLORS, BRAND_FONTS } from "../config/brand";
import { gaEvent, trackGameStart } from "../utils/analytics";
import { createAudioKit } from "./audio";
import { mulberry32, randomSeed } from "./rng";
import type { AudioKit, GameHost, GameManifest, GameResult, Haptics, SafeArea } from "./sdk";
import { getBest, setBest } from "./storage/bestScore";

/** What the platform learns when a run ends. Duration is measured here, never by the game. */
export type RunResult = GameResult & { durationMs: number };

export type HostOptions = {
  onGameOver: (result: RunResult) => void;
  /** Injected for tests. */
  now?: () => number;
  audio?: AudioKit;
  analytics?: GameHost["analytics"];
};

/** The host plus the controls only the platform uses (mount and PlayGame). */
export type PlatformHost = GameHost & {
  /** A new run starts: reset the clock and allow one gameOver(). */
  beginRun(): void;
  setPaused(paused: boolean): void;
};

const haptics: Haptics = {
  tap: () => vibrate(10),
  success: () => vibrate([20, 40, 20]),
  fail: () => vibrate(60),
};

function vibrate(pattern: number | number[]): void {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(pattern);
    }
  } catch {
    // unsupported: ignore
  }
}

/** Reads the safe-area insets published as CSS variables in index.css. */
function readSafeArea(): SafeArea {
  if (typeof document === "undefined") return { top: 0, right: 0, bottom: 0, left: 0 };
  const style = getComputedStyle(document.documentElement);
  const px = (name: string) => Number.parseFloat(style.getPropertyValue(name)) || 0;
  return {
    top: px("--safe-top"),
    right: px("--safe-right"),
    bottom: px("--safe-bottom"),
    left: px("--safe-left"),
  };
}

export function createHost(manifest: GameManifest, options: HostOptions): PlatformHost {
  const now = options.now ?? (() => performance.now());
  const audio = options.audio ?? createAudioKit(manifest.id, manifest.sfx ?? []);
  const analytics: GameHost["analytics"] = options.analytics ?? {
    event: (name, params) => gaEvent(name, { game_id: manifest.id, ...params }),
  };

  let runStartedAt = now();
  let pausedAt: number | null = null;
  let pausedTotal = 0;
  let ended = false;

  return {
    manifest,
    audio,
    haptics,
    analytics,
    fonts: BRAND_FONTS,
    colors: BRAND_COLORS,
    best: {
      get: () => getBest(manifest.id),
      submit: (score) => setBest(manifest.id, score),
    },
    rng: (seed) => mulberry32(seed ?? randomSeed()),
    safeArea: readSafeArea,
    isPaused: () => pausedAt !== null,
    reducedMotion: () =>
      typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches,

    beginRun() {
      runStartedAt = now();
      pausedAt = null;
      pausedTotal = 0;
      ended = false;
      trackGameStart(manifest.id, manifest.title);
    },

    setPaused(paused) {
      if (paused && pausedAt === null) pausedAt = now();
      if (!paused && pausedAt !== null) {
        pausedTotal += now() - pausedAt;
        pausedAt = null;
      }
    },

    gameOver(result) {
      if (ended) return; // one result per run, however many times a scene calls it
      ended = true;
      const end = pausedAt ?? now();
      const durationMs = Math.max(0, Math.round(end - runStartedAt - pausedTotal));
      const score = Number.isFinite(result.score) ? Math.max(0, Math.floor(result.score)) : 0;
      setBest(manifest.id, score);
      options.onGameOver({ ...result, score, durationMs });
    },
  };
}
