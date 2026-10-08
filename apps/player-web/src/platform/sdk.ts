/**
 * The Game SDK contract (T4.3). A game is a folder under src/games/<id>/ with:
 *   manifest.ts  export default defineGame({...})   (metadata only: no Phaser import)
 *   index.ts     export const create: CreateGame      (loaded lazily when played)
 *
 * Games talk to the platform only through the GameHost they are given; they never
 * touch window events, localStorage or navigation. See platform/README.md.
 */
import type { BRAND_COLORS, BRAND_FONTS } from "../config/brand";

export type GameStatus = "active" | "beta" | "inactive";

export type InputKind = "tap" | "hold" | "swipe" | "drag" | "dpad" | "keyboard";

/** A tunable a kid can change in remix mode (Phase 11). */
export type RemixKnob = {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
};

export type GameManifest = {
  /** Folder name and URL slug: lowercase letters, digits and dashes. */
  id: string;
  title: string;
  /** One short line for tiles and link previews (≤ 80 chars). */
  tagline: string;
  description: string;
  objective: string;
  controls: string;
  /** Who made it, shown as "Made by …". */
  makers: string[];
  /** Designer's note from the kid who made it (Phase 11). */
  note?: string;
  noteBy?: string;
  /** active: everyone; beta: beta testers; inactive: hidden, direct link shows "taking a break". */
  status: GameStatus;
  orientation: "portrait";
  /** Design resolution; Phaser scales it to fit. */
  design: { w: number; h: number };
  input: InputKind[];
  /**
   * Server-side sanity limits and XP rate. The backend reads these (Phase 6),
   * the client never sends them.
   */
  scoring: { max: number; perSecondMax: number; xpMultiplier: number };
  /** Cover image path under public/ (raster, square). */
  cover: string;
  createdAt: string;
  updatedAt: string;
  seo: { description: string; category: GameCategory };
  /** Recorded effects in public/assets/<id>/sfx/<name>.mp3, played by host.audio.play(name). */
  sfx?: string[];
  remix?: RemixKnob[];
};

export type GameCategory =
  "reflex" | "puzzle" | "word" | "arcade" | "sports" | "memory" | "action" | "casual" | "strategy";

/** What a finished run reports. Duration is measured by the platform, not the game. */
export type GameResult = {
  score: number;
  /** Optional per-game numbers for analytics and achievements (no PII). */
  stats?: Record<string, number>;
};

export type AudioKit = {
  readonly muted: boolean;
  beep(freq?: number, ms?: number): void;
  ding(): void;
  thud(): void;
  pop(): void;
  /** Plays a named effect from public/assets/<id>/sfx/ if loaded, else a synth fallback. */
  play(name: string): void;
};

export type Haptics = {
  tap(): void;
  success(): void;
  fail(): void;
};

export type SafeArea = { top: number; right: number; bottom: number; left: number };

export type GameHost = {
  readonly manifest: GameManifest;
  /** Report the end of a run. The platform shows game over and submits the score. */
  gameOver(result: GameResult): void;
  /** This device's best score for the game. */
  best: { get(): number; submit(score: number): number };
  audio: AudioKit;
  haptics: Haptics;
  /** Deterministic random numbers in [0, 1). Same seed, same sequence. */
  rng(seed?: number): () => number;
  /** Device safe-area insets in CSS pixels. */
  safeArea(): SafeArea;
  analytics: { event(name: string, params?: Record<string, string | number | boolean>): void };
  fonts: typeof BRAND_FONTS;
  colors: typeof BRAND_COLORS;
  isPaused(): boolean;
};

/** A running game, controlled by the platform. */
export type GameInstance = {
  start(): void;
  pause(): void;
  resume(): void;
  /** Start a fresh run without creating a new Phaser.Game (no new WebGL context). */
  restart(): void;
  destroy(): void;
  setMuted(muted: boolean): void;
};

export type CreateGame = (host: GameHost, el: HTMLElement) => GameInstance;

export type GameModule = { manifest: GameManifest; create: CreateGame };

/**
 * Declare a game's manifest. Returns it unchanged with full typing; the shape and
 * values are checked by platform/manifest.test.ts (zod), so mistakes fail `npm test`
 * without shipping a validator to players.
 */
export function defineGame<const M extends GameManifest>(manifest: M): M {
  return manifest;
}
